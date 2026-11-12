import ExcelJS from 'exceljs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
import { validDateRange } from '@/lib/order-finance';
import { getProductSales, emptySalesCounts } from '@/lib/product-sales';
import { getProductFinancials } from '@/lib/product-financials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KST = 'Asia/Seoul';
const dateKst = (value: string | Date) =>
  new Date(value).toLocaleString('sv-SE', { timeZone: KST, hour12: false });
const asNum = (value: unknown) => Number(value || 0);
const clean = (value: unknown) =>
  String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 250);
const moneyFmt = '#,##0;[Red](#,##0);-';

type CatalogRow = {
  id: string; name: string; product_code: string | null; category: string | null;
  sale_type: string | null; is_visible: boolean | null; archived_at: string | null;
};

function writeSheet(
  book: ExcelJS.Workbook,
  title: string,
  cols: { key: string; header: string; width: number; money?: boolean }[],
  rows: Record<string, unknown>[],
) {
  const sheet = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = cols.map(({ key, header, width }) => ({ key, header, width }));
  for (const row of rows) {
    const mapped: Record<string, string | number | boolean | null> = {};
    for (const col of cols) {
      const value = row[col.key];
      mapped[col.key] = typeof value === 'number' && Number.isFinite(value)
        ? value : typeof value === 'boolean' ? value : value == null ? null : clean(value);
    }
    sheet.addRow(mapped);
  }
  const header = sheet.getRow(1);
  header.height = 30;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF315E43' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  for (let i = 0; i < cols.length; i++) if (cols[i].money)
    sheet.getColumn(i + 1).numFmt = moneyFmt;
  for (let i = 2; i <= rows.length + 1; i++) {
    if (i % 2 === 0) sheet.getRow(i).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8F5' },
    };
  }
  return sheet;
}

async function handleGET(request: Request) {
  const token = (await cookies()).get('admin_token')?.value;
  if (!token || !await verifyAdminToken(token))
    return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const site = (await currentAdminSite()).key;
  if (site !== 'sanjipick')
    return NextResponse.json({ error: '산지픽 관리자 전용 기능입니다.' }, { status: 404 });

  const query = new URL(request.url).searchParams;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const from = query.get('from') ?? '2026-09-01';
  const to = query.get('to') ?? today;
  if (!validDateRange(from, to) || Date.parse(to) - Date.parse(from) > 366 * 86400000)
    return NextResponse.json({ error: '조회 기간은 1년 이내로 선택해주세요.' }, { status: 400 });

  try {
    // All financial queries use the payment timestamp and the authenticated host's site.
    // Never export payment keys, recipient/buyer details or address/phone metadata.
    const aggregateSql = [
      'SELECT COUNT(*)::int AS orders,COALESCE(SUM(total_amount),0)::bigint AS gross,',
      'COALESCE(SUM(shipping_fee),0)::bigint AS shipping,',
      'COUNT(*) FILTER(WHERE shipping_fee>0)::int AS paid_shipping_orders,',
      'COALESCE(SUM(refunds),0)::bigint AS refunds,',
      'COUNT(*) FILTER(WHERE pending_refunds OR refund_amount_unresolved OR refunds>total_amount',
      "OR (status IN ('cancelled','return_completed') AND refund_count=0))::int AS unresolved",
      'FROM (SELECT o.status,o.total_amount,o.shipping_fee,o.refund_amount_unresolved,',
      "EXISTS(SELECT 1 FROM refund_operations op WHERE op.order_id=o.id AND op.status NOT IN ('completed','rejected')) AS pending_refunds,",
      'COALESCE(ra.amount,0) AS refunds,COALESCE(ra.refund_count,0) AS refund_count',
      'FROM orders o LEFT JOIN LATERAL (SELECT SUM(amount) AS amount,COUNT(*) AS refund_count',
      'FROM order_refund_amounts WHERE order_id=o.id) ra ON true',
      "WHERE o.site=$1 AND o.order_type IN ('shop','campaign') AND o.paid_at IS NOT NULL",
      "AND NULLIF(o.payment_key,'') IS NOT NULL AND o.payment_key NOT LIKE 'SIM_%'",
      "AND o.status<>'pending' AND o.paid_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul')",
      "AND o.paid_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')) x",
    ].join(' ');
    const [sales, money, raw] = await Promise.all([
      getProductSales('sanjipick', from, to),
      getProductFinancials('sanjipick', from, to, undefined, shopPool, true),
      shopPool.query(aggregateSql, ['sanjipick', from, to]),
    ]);
    const ids = [...new Set([...sales.keys(), ...money.keys()])];
    const catalog = ids.length ? await shopPool.query<CatalogRow>(
      'SELECT id,name,product_code,category,sale_type,is_visible,archived_at FROM products_shop WHERE id=ANY($1::uuid[])',
      [ids],
    ) : { rows: [] as CatalogRow[] };
    const metadata = new Map(catalog.rows.map(row => [row.id, row]));
    // Historical product snapshots survive catalog deletion/archiving.
    const snapshots = ids.length ? await shopPool.query<{ id: string; product_name: string }>(
      "SELECT DISTINCT ON (COALESCE(oi.product_ref,oi.product_id)) " +
      "COALESCE(oi.product_ref,oi.product_id) AS id,oi.product_name " +
      "FROM order_items oi JOIN orders o ON o.id=oi.order_id " +
      "WHERE o.site=$1 AND o.order_type IN ('shop','campaign') AND o.paid_at IS NOT NULL " +
      "AND o.paid_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul') " +
      "AND o.paid_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul') " +
      "AND COALESCE(oi.product_ref,oi.product_id)=ANY($4::uuid[]) " +
      "ORDER BY COALESCE(oi.product_ref,oi.product_id),o.paid_at DESC",
      ['sanjipick', from, to, ids],
    ) : { rows: [] as { id: string; product_name: string }[] };
    const fallback = new Map(snapshots.rows.map(row => [row.id, row.product_name]));
    const label = (id: string) => metadata.get(id)?.name || fallback.get(id) || '상품명 확인 필요';
    const rawTotal = raw.rows[0] || {};
    const gross = asNum(rawTotal.gross);
    const refunded = asNum(rawTotal.refunds);
    const unresolved = asNum(rawTotal.unresolved);

    const productRows = ids.map(id => {
      const m = money.get(id);
      const q = sales.get(id) || { ...emptySalesCounts(), options: [] };
      const p = metadata.get(id);
      return {
        code: p?.product_code || '', name: label(id), id,
        type: p?.sale_type === 'groupbuy' ? '공동구매' : '상시/미확인',
        visible: p?.is_visible === false ? '비전시' : '전시/미확인',
        archive: p?.archived_at ? '보관' : '현행/미확인',
        orders: m?.orders ?? q.orders,
        paidUnits: q.paid, cancelledUnits: q.cancelled, returnedUnits: q.returned,
        soldUnits: q.sold, gross: m?.gross ?? 0, refunds: m?.refunds ?? 0,
        net: m?.net ?? null, supplierCost: m?.supplyCost ?? null, expectedMargin: m?.grossMargin ?? null,
        supplierMarkup: m?.supplyCost && m.grossMargin != null ? Number((m.grossMargin / m.supplyCost * 100).toFixed(1)) : null,
        marginReview: m?.marginReviewOrders || 0, shippingPayments: m?.shippingPayments ?? 0,
        shipping: m?.shipping ?? 0, displayOrders: m?.displayOrders ?? 0,
        hiddenOrders: m?.nonDisplayOrders ?? 0,
        check: m?.review || q.review ? '대조 필요' : '정상',
      };
    }).sort((a,b)=>b.gross-a.gross || a.name.localeCompare(b.name, 'ko'));

    const orderRows = [...money.entries()].flatMap(([id, m]) =>
      m.orderRows.map(row => ({
        date: dateKst(row.paidAt), orderNumber: row.orderNumber,
        code: metadata.get(id)?.product_code || '', name: label(id),
        channel: row.channel === 'non_display' ? '비전시' : '전시',
        status: row.status, units: row.units, gross: row.gross,
        refunds: row.refunds, net: row.review ? null : row.gross - row.refunds,
        shippingPaid: row.shippingPaid ? '유료' : '무료',
        shipping: row.shipping, supplierCost: row.supplyCost, expectedMargin: row.grossMargin,
        marginReview: row.marginReview ? '환불·취소 주의' : '단순 예상 마진',
        check: row.review ? '금액 대조 필요' : row.estimated ? '주문 내 금액 배분' : '직접 집계',
      }))
    ).sort((a,b)=>a.date.localeCompare(b.date) || a.orderNumber.localeCompare(b.orderNumber));

    const optionRows = [...sales.entries()].flatMap(([id, q]) =>
      q.options.map(option => ({
        code: metadata.get(id)?.product_code || '', name: label(id),
        option: option.label, orders: option.orders,
        paid: option.paid, cancelled: option.cancelled, returned: option.returned,
        sold: option.sold, supplierCost: option.supplyCost, expectedMargin: option.grossMargin,
        supplierMarkup: option.grossMargin==null || !option.supplyCost ? null : Number((option.grossMargin / option.supplyCost * 100).toFixed(1)),
        marginReview: option.marginReview ? '환불·취소 주의 '+option.marginReview+'건' : '환불 전 명목마진',
        check: option.review ? '수량 대조 필요' : '정상',
      }))
    ).sort((a,b)=>a.name.localeCompare(b.name, 'ko') || b.sold-a.sold);

    const book = new ExcelJS.Workbook();
    book.creator = 'Sanjipick Admin';
    book.created = new Date();
    const overview = book.addWorksheet('전체 요약');
    const attributed = productRows.reduce((sum, p) => sum + p.gross, 0);
    const overviewRows: [string, string | number][] = [
      ['사이트','산지픽'],['결제일 시작',from],['결제일 종료',to],
      ['조회 기준','한국시간 결제일 · 현재까지 확정된 환불액 반영'],
      ['결제 주문 수',asNum(rawTotal.orders)],['판매된 상품 종류',productRows.length],
      ['최초 주문 수량',productRows.reduce((n,p)=>n+p.paidUnits,0)],
      ['취소 완료 수량',productRows.reduce((n,p)=>n+p.cancelledUnits,0)],
      ['반품 완료 수량',productRows.reduce((n,p)=>n+p.returnedUnits,0)],
      ['실판매 수량',productRows.reduce((n,p)=>n+p.soldUnits,0)],
      ['원주문 총 결제액(배송비 포함)',gross],['확인된 환불액',refunded],
      ['순 결제액',unresolved ? '금액 대조 필요' : gross-refunded],
      ['원주문 유료배송 결제 건수',asNum(rawTotal.paid_shipping_orders)],
      ['원주문 배송비 총액',asNum(rawTotal.shipping)],
      ['금액 대조 필요 주문',unresolved],
      ['상품별 배분 결제액 합계',attributed],
      ['상품 식별 불가 결제액 차이',gross-attributed],
    ];
    overview.columns = [{ header:'구분',key:'label',width:35 },{ header:'값',key:'value',width:46 }];
    for (const [label,value] of overviewRows) overview.addRow({label,value});
    overview.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    overview.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315E43'}};
    overview.getColumn(2).numFmt=moneyFmt;
    overview.views=[{state:'frozen',ySplit:1}];

    writeSheet(book,'상품별 실적',[
      {key:'code',header:'상품코드',width:14},{key:'name',header:'상품명',width:32},
      {key:'type',header:'판매방식',width:14},{key:'visible',header:'현재 전시',width:16},
      {key:'archive',header:'보관 상태',width:15},{key:'orders',header:'상품별 결제주문 건수',width:18},
      {key:'paidUnits',header:'결제 수량',width:13},{key:'cancelledUnits',header:'취소 수량',width:13},
      {key:'returnedUnits',header:'반품 수량',width:13},{key:'soldUnits',header:'실판매 수량',width:13},
      {key:'gross',header:'총 결제액(원)',width:18,money:true},
      {key:'refunds',header:'환불액(원)',width:18,money:true},
      {key:'net',header:'순 결제액(원)',width:18,money:true},
      {key:'supplierCost',header:'주문 당시 상품 공급가(원)',width:25,money:true},
      {key:'expectedMargin',header:'환불 전 예상 마진금액(원)',width:25,money:true},
      {key:'supplierMarkup',header:'공급가 대비 마진율(%)',width:20},
      {key:'marginReview',header:'마진 대조 대상 주문 수',width:22},
      {key:'shippingPayments',header:'유료배송 주문 건수',width:18},
      {key:'shipping',header:'배송비(원)',width:16,money:true},
      {key:'displayOrders',header:'전시 주문',width:12},
      {key:'hiddenOrders',header:'비전시 주문',width:14},
      {key:'check',header:'검토 상태',width:18},
    ],productRows);
    writeSheet(book,'주문별 상세',[
      {key:'date',header:'결제일시(KST)',width:22},{key:'orderNumber',header:'주문번호',width:26},
      {key:'code',header:'상품코드',width:14},{key:'name',header:'상품명',width:32},
      {key:'channel',header:'결제 경로',width:13},{key:'status',header:'주문 상태',width:18},
      {key:'units',header:'주문 수량',width:14},{key:'gross',header:'상품 배분 결제액(원)',width:22,money:true},
      {key:'refunds',header:'상품 배분 환불액(원)',width:22,money:true},
      {key:'net',header:'배분 순 결제액(원)',width:20,money:true},
      {key:'shippingPaid',header:'유료배송 여부',width:16},
      {key:'shipping',header:'배분 배송비(원)',width:19,money:true},
      {key:'supplierCost',header:'상품 공급가 합계(원)',width:23,money:true},
      {key:'expectedMargin',header:'환불 전 예상 마진(원)',width:23,money:true},
      {key:'marginReview',header:'마진 확인',width:19},
      {key:'check',header:'정산 확인',width:22},
    ],orderRows);
    writeSheet(book,'옵션별 수량',[
      {key:'code',header:'상품코드',width:14},{key:'name',header:'상품명',width:32},
      {key:'option',header:'옵션 구성',width:40},{key:'orders',header:'주문 건수',width:14},
      {key:'paid',header:'결제 수량',width:14},{key:'cancelled',header:'취소 수량',width:14},
      {key:'returned',header:'반품 수량',width:14},{key:'sold',header:'실판매 수량',width:16},
      {key:'supplierCost',header:'원가 합계(원)',width:20,money:true},
      {key:'expectedMargin',header:'환불 전 예상 마진금액(원)',width:25,money:true},
      {key:'supplierMarkup',header:'공급가 대비 마진율(%)',width:20},
      {key:'marginReview',header:'마진 주의',width:23},
      {key:'check',header:'검토 상태',width:18},
    ],optionRows);
    const notes = book.addWorksheet('집계 기준');
    [
      ['항목','적용 기준'],
      ['기간','2026-09-01~조회 종료일까지 한국시간 결제일 기준'],
      ['포함','산지픽 사이트의 결제 완료 일반상품·공동구매 주문, 종료·비전시·보관 상품 포함'],
      ['제외','미결제, 테스트(SIM_) 주문, 호텔 등 일반상품/공구가 아닌 주문'],
      ['실판매 수량','결제 수량 - 취소 완료 수량 - 반품 완료 수량'],
      ['총 결제액','주문 총 결제액(배송비 포함). 상품별 금액은 주문 구성 비중으로 배분'],
      ['환불액','조회 시점까지 확정된 환불액. 해당 결제일 주문에 귀속'],
      ['배송비','원주문에서는 1회 집계. 상품별 배송비/배송 건수는 여러 상품 주문에서 각각 배분·표시 가능'],
      ['예상 마진','결제 당시 상품별 판매액(배송비 제외) - 주문 당시 저장된 공급가×수량. 환불 전 단순 상품 차익으로 광고·PG·수수료·세금·배송원가 미반영'],
      ['마진 검토','취소·반품·환불 주문은 원가 회수 여부가 확인되지 않아 확정 이익으로 취급하지 않음'],
      ['순 결제액','환불이 미확정이거나 불일치 시 숫자 대신 대조 필요'],
      ['옵션 수량','옵션별 수량은 주문 당시 선택 구성을 기준으로 하며 금액 배분과 분리'],
      ['개인정보','고객 이름·전화번호·주소·결제키는 포함하지 않음'],
    ].forEach(row=>notes.addRow(row));
    notes.columns=[{width:24},{width:115}];
    notes.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    notes.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315E43'}};

    const bytes=await book.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(bytes),{
      status:200,
      headers:{
        'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sanjipick-sales-'+from+'_to_'+to+'.xlsx"',
        'Cache-Control':'private, no-store, max-age=0',
        'X-Content-Type-Options':'nosniff',
      },
    });
  }catch(error){
    console.error('[sanjipick-sales-export] failed',error);
    return NextResponse.json({error:'상품별 판매실적 다운로드를 준비하지 못했습니다. 다시 시도해주세요.'},{status:503});
  }
}
export const GET=handleGET;
