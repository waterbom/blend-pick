import ExcelJS from 'exceljs';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite, adminProductScopeSql } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
import { validDateRange } from '@/lib/order-finance';
import { getProductSales, emptySalesCounts } from '@/lib/product-sales';
import { getProductFinancials, emptyProductMoney } from '@/lib/product-financials';
import type { ProductMoney } from '@/lib/product-financials';
import type { ProductSales } from '@/lib/product-sales';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductRow = {
  id: string; name: string; brand: string | null; category: string | null;
  product_code: string | null; sale_type: string | null; sale_start_at: string | null;
  sale_end_at: string | null; status: string; is_visible: boolean | null;
  archived_at: string | null;
};
type FinancialTotal = {
  orders: number; gross: string; refunds: string; shipping: string;
  shipping_payments: number; review: number;
};
type MonthlyTotal = FinancialTotal & { month: string };
const green = 'FF315742';
const bronze = 'FF96562F';
const pale = 'FFF3F6F1';
const paleBrown = 'FFF9F2ED';
const wonFormat = '#,##0;[Red]-#,##0';
const intFormat = '#,##0';
const kst = (value: string) =>
  new Date(value).toLocaleString('sv-SE', {timeZone:'Asia/Seoul',hour12:false});
const dateKst = (value: string | null) => value ? kst(value).slice(0, 10) : '';
const num = (value: unknown) => Number(value || 0);
const safe = (value: unknown) => String(value ?? '');

function styleSheet(ws: ExcelJS.Worksheet, title: string, from: string, to: string,
  headers: string[], widths: number[], freezeColumns = 2) {
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = title;
  ws.getRow(1).height = 33;
  ws.getCell(1, 1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:green}};
  ws.getCell(1, 1).font = {name:'Malgun Gothic',size:16,bold:true,color:{argb:'FFFFFFFF'}};
  ws.getCell(1, 1).alignment = {vertical:'middle',indent:1};
  ws.mergeCells(2, 1, 2, headers.length);
  ws.getCell(2, 1).value = '산지픽 | 결제일 ' + from + ' ~ ' + to + ' (한국시간) | 조회 시점까지 확정된 환불 반영';
  ws.getRow(2).height = 26;
  ws.getCell(2, 1).font = {name:'Malgun Gothic',size:10,color:{argb:bronze}};
  ws.getCell(2, 1).alignment = {vertical:'middle',indent:1};
  ws.getRow(4).values = headers;
  ws.getRow(4).height = 29;
  ws.getRow(4).eachCell(cell => {
    cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:bronze}};
    cell.font = {name:'Malgun Gothic',bold:true,color:{argb:'FFFFFFFF'},size:10};
    cell.alignment = {vertical:'middle',wrapText:true};
    cell.border = {bottom:{style:'thin',color:{argb:'FFDED7CF'}}};
  });
  ws.columns = widths.map(width => ({width}));
  ws.views = [{state:'frozen',xSplit:freezeColumns,ySplit:4}];
  ws.autoFilter = {from:{row:4,column:1},to:{row:4,column:headers.length}};
  ws.properties.defaultRowHeight = 22;
}
function append(ws: ExcelJS.Worksheet, cells: (string | number | null | ExcelJS.CellFormulaValue)[], currencyCols: number[] = []) {
  const row = ws.addRow(cells);
  row.height = 23;
  row.eachCell((cell, col) => {
    cell.font = {name:'Malgun Gothic',size:10,color:{argb:'FF29352F'}};
    cell.alignment = {vertical:'middle',wrapText: col <= 3};
    if (row.number % 2 === 0) cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:pale}};
    if (typeof cell.value === 'number' || (typeof cell.value === 'object' && cell.value !== null && 'formula' in cell.value)) {
      cell.numFmt = currencyCols.includes(col) ? wonFormat : intFormat;
      cell.alignment = {vertical:'middle',horizontal:'right'};
    }
  });
  return row;
}

const eligibleSql = [
  'o.site=$1',
  "o.order_type IN ('shop','campaign')",
  'o.paid_at IS NOT NULL',
  "NULLIF(o.payment_key,'') IS NOT NULL",
  "o.payment_key NOT LIKE 'SIM_%'",
  "o.status <> 'pending'",
  "o.paid_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul')",
  "o.paid_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')",
].join(' AND ');
const refundsSql = [
  'LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount),0) AS amount,COUNT(*)::int AS n',
  'FROM order_refund_amounts WHERE order_id=o.id) r ON true',
].join(' ');
const refundReviewSql = [
  '(o.refund_amount_unresolved',
  "OR (o.status IN ('cancelled','return_completed') AND r.n=0)",
  'OR r.amount>o.total_amount',
  "OR EXISTS (SELECT 1 FROM refund_operations p WHERE p.order_id=o.id AND p.status NOT IN ('completed','rejected')))",
].join(' ');
async function rawTotals(db: PoolClient, from: string, to: string) {
  const values = ['sanjipick',from,to];
  const summarySql = [
    'SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total_amount),0)::bigint AS gross,',
    'COALESCE(SUM(r.amount),0)::bigint AS refunds, COALESCE(SUM(o.shipping_fee),0)::bigint AS shipping,',
    'COUNT(*) FILTER (WHERE o.shipping_fee>0)::int AS shipping_payments,',
    'COUNT(*) FILTER (WHERE ' + refundReviewSql + ')::int AS review',
    'FROM orders o',refundsSql,'WHERE ' + eligibleSql,
  ].join(' ');
  const monthlySql = [
    "SELECT to_char(o.paid_at AT TIME ZONE 'Asia/Seoul','YYYY-MM') AS month,",
    'COUNT(*)::int AS orders, COALESCE(SUM(o.total_amount),0)::bigint AS gross,',
    'COALESCE(SUM(r.amount),0)::bigint AS refunds, COALESCE(SUM(o.shipping_fee),0)::bigint AS shipping,',
    'COUNT(*) FILTER (WHERE o.shipping_fee>0)::int AS shipping_payments,',
    'COUNT(*) FILTER (WHERE ' + refundReviewSql + ')::int AS review',
    'FROM orders o',refundsSql,'WHERE ' + eligibleSql,
    "GROUP BY to_char(o.paid_at AT TIME ZONE 'Asia/Seoul','YYYY-MM') ORDER BY month",
  ].join(' ');
  const summary = await db.query<FinancialTotal>(summarySql,values);
  const monthly = await db.query<MonthlyTotal>(monthlySql,values);
  return {total:summary.rows[0],monthly:monthly.rows};
}
async function catalogAndHistory(db: PoolClient, from: string, to: string) {
  const scope = adminProductScopeSql('sanjipick','category',1);
  const products = await db.query<ProductRow>(
    'SELECT id,name,brand,category,product_code,sale_type,sale_start_at,sale_end_at,status,is_visible,archived_at '+
    'FROM products_shop WHERE '+scope.sql, [scope.param]);
  const snapshots = await db.query<{product_id:string;product_name:string}>([
    'SELECT DISTINCT ON (COALESCE(i.product_ref,i.product_id))',
    'COALESCE(i.product_ref,i.product_id)::text AS product_id, i.product_name',
    'FROM order_items i JOIN orders o ON o.id=i.order_id',
    'WHERE '+eligibleSql+' AND COALESCE(i.product_ref,i.product_id) IS NOT NULL',
    'ORDER BY COALESCE(i.product_ref,i.product_id), (i.product_id IS NULL), o.paid_at DESC, i.id',
  ].join(' '),['sanjipick',from,to]);
  return {
    catalog:new Map(products.rows.map(p=>[String(p.id),p])),
    snapshots:new Map(snapshots.rows.map(p=>[String(p.product_id),p.product_name])),
  };
}
function labelStatus(p?: ProductRow) {
  if (!p) return '상품 정보 없음';
  if (p.archived_at) return '보관';
  return p.status==='active' ? '등록' : safe(p.status);
}

function generateWorkbook(args: {
  from: string;to: string;total: FinancialTotal;monthly: MonthlyTotal[];
  sales: Map<string,ProductSales>;financials: Map<string,ProductMoney>;
  catalog: Map<string,ProductRow>;snapshots: Map<string,string>;
}) {
  const {from,to,total,monthly,sales,financials,catalog,snapshots}=args;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sanjipick Admin';
  workbook.subject = '산지픽 상품별 판매 상세 내역 (개인정보 제외)';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const ids = [...new Set([...financials.keys(),...sales.keys()])];
  const products = ids.map(id=>({
    id,p:catalog.get(id),name:catalog.get(id)?.name || snapshots.get(id) || '상품명 확인 필요',
    money:financials.get(id) || emptyProductMoney(),
    sales:sales.get(id) || {...emptySalesCounts(),options:[]},
  })).filter(p=>p.money.orders>0 || p.sales.paid>0)
    .sort((a,b)=>b.money.gross-a.money.gross || a.name.localeCompare(b.name,'ko'));
  const allocatedGross = products.reduce((n,p)=>n+p.money.gross,0);
  const allocatedRefund = products.reduce((n,p)=>n+p.money.refunds,0);
  const summary = workbook.addWorksheet('집계요약');
  styleSheet(summary,'산지픽 전체 판매·환불·배송비 집계',from,to,
    ['지표','금액 또는 건수','기준 및 참고'],[30,25,98],1);
  const lines: (string | number)[][] = [
    ['원결제 주문 건수',num(total.orders),'실제 결제 완료된 서로 다른 주문번호 기준'],
    ['총 결제액 (배송비 포함)',num(total.gross),'전체 주문의 실결제액이며 상품별 배분액과 구분'],
    ['확정 환불액',num(total.refunds),'조회 기간 내 결제된 주문에 대해 현재까지 저장된 환불 합계'],
    ['순 결제액',num(total.review)>0 ? '금액 대조 필요' : num(total.gross)-num(total.refunds),
      '미완료 환불/불일치 건이 있으면 확정값 대신 검토 필요 표시'],
    ['원주문 유료배송 결제 건수',num(total.shipping_payments),'서로 다른 주문 기준, 상품별 건수를 합산하지 않음'],
    ['원주문 배송비 결제액',num(total.shipping),'전체 주문의 배송비 항목 합계'],
    ['확인 필요 주문 건수',num(total.review),'환불 미완료/내역 불일치 가능성'],
    ['판매 이력 있는 제품 종류',products.length,'보관·판매 종료·현재 비전시·삭제된 상품 주문도 포함'],
    ['상품별 배분 결제액 합계',allocatedGross,'여러 상품 혼합 주문은 금액 비중으로 배분'],
    ['배분되지 않은 결제액',num(total.gross)-allocatedGross,
      '과거 상품 연결이 없는 주문 품목 등이 있으면 차이 발생'],
    ['상품별 배분 환불액 합계',allocatedRefund,'상품 식별 가능 시 해당 상품, 불가능하면 비중 배분'],
    ['배분되지 않은 환불액',num(total.refunds)-allocatedRefund,'주문/상품 연결 기록 확인용'],
  ];
  for(const v of lines) append(summary,v,[2]);
  summary.getCell('A19').value='집계 기준';
  summary.getCell('A19').font={bold:true,size:12,color:{argb:green}};
  const notes=[
    '한국시간 결제일 기준으로 기간 양끝 날짜를 포함합니다. 조회 종료일 이후 발생한 환불도 현재까지 확정된 경우 반영합니다.',
    '미결제/테스트 결제와 숙박·차액 주문은 제외하고 shop·campaign 상품 주문만 포함합니다.',
    '상품별 주문 건수 및 배송비 결제 건수는 같은 주문에 여러 상품이 있으면 상품별로 각각 표시되므로 합산 시 중복될 수 있습니다.',
    '상품별 결제액·환불액·배송비는 주문 당시 상품 금액 비중으로 배분한 값일 수 있으며 세금계산서 또는 최종 PG 정산액과 다를 수 있습니다.',
    '고객 성명·전화번호·주소·결제키는 포함하지 않았습니다. 주문번호는 산지픽 관리자에서 조회 가능합니다.',
  ];
  notes.forEach((note,i)=>{summary.mergeCells(20+i,1,20+i,3);summary.getCell(20+i,1).value='• '+note;summary.getCell(20+i,1).alignment={wrapText:true,vertical:'middle'};summary.getRow(20+i).height=30;});
  const monthlySheet=workbook.addWorksheet('월별합계');
  styleSheet(monthlySheet,'월별 실제 결제·환불·배송비',from,to,
    ['결제월','원결제 주문건수','총 결제액','확정 환불액','순 결제액','유료배송 결제건수','배송비 합계','대조 필요 주문'],[14,20,22,22,22,23,20,23],1);
  monthly.forEach(m=>{
    const row=append(monthlySheet,[m.month,num(m.orders),num(m.gross),num(m.refunds),
      num(m.review)>0?'대조 필요':num(m.gross)-num(m.refunds),num(m.shipping_payments),num(m.shipping),num(m.review)],[3,4,5,7]);
    if (num(m.review)===0) row.getCell(5).value={formula:'C'+row.number+'-D'+row.number,result:num(m.gross)-num(m.refunds)};
  });
  const pSheet=workbook.addWorksheet('상품별실적');
  styleSheet(pSheet,'전체 상품별 판매 실적',from,to,
    ['상품코드','상품명','브랜드','카테고리','판매방식','현재 전시상태','등록상태','공구 시작','공구 종료','결제 주문건수',
      '결제 수량','취소완료 수량','반품완료 수량','실판매 수량','배분 총결제액','배분 환불액','배분 순결제액',
      '유료배송 결제건수','배분 배송비','전시 결제건수','비전시 결제건수','금액 대조필요 건수','배분 추정 건수','상품ID'],
    [15,34,20,21,15,15,16,16,16,17,16,17,17,17,22,21,22,21,21,19,19,21,18,39]);
  products.forEach(item=>{
    const {p,money:m,sales:s}=item;
    const values:(string|number|null|ExcelJS.CellFormulaValue)[]=[
      p?.product_code || '',item.name,p?.brand || '',p?.category || '',
      p?.sale_type==='groupbuy'?'공동구매':p?.sale_type==='always'?'상시 판매':safe(p?.sale_type),
      !p?'상품 정보 없음':p.is_visible===false?'비전시':'전시',
      labelStatus(p),dateKst(p?.sale_start_at||null),dateKst(p?.sale_end_at||null),
      m.orders,s.paid,s.cancelled,s.returned,s.sold,m.gross,m.refunds,
      m.net===null?'대조 필요':m.net,m.shippingPayments,m.shipping,m.displayOrders,
      m.nonDisplayOrders,m.review,m.estimatedOrders,item.id,
    ];
    const row=append(pSheet,values,[15,16,17,19]);
    if(m.net!==null) row.getCell(17).value={formula:'O'+row.number+'-P'+row.number,result:m.net};
  });
  const optSheet=workbook.addWorksheet('옵션별수량');
  styleSheet(optSheet,'상품 옵션별 결제·취소·반품 수량',from,to,
    ['상품코드','상품명','옵션명','옵션 식별자','결제 주문건수','결제 수량','취소완료 수량',
     '반품완료 수량','실판매 수량','수량 검토필요 건수','취소·반품 진행중 주문'],[15,33,36,43,22,20,19,19,18,24,27]);
  products.forEach(item=>{
    item.sales.options.forEach(o=>append(optSheet,[
      item.p?.product_code||'',item.name,o.label,o.key,o.orders,o.paid,o.cancelled,
      o.returned,o.sold,o.review,o.pending,
    ]));
  });
  const detailSheet=workbook.addWorksheet('주문별상세');
  styleSheet(detailSheet,'상품별 주문·결제·환불 상세 내역',from,to,
    ['결제일시 (한국시간)','상품코드','상품명','주문번호','주문상태','구매 경로','상품 주문수량',
     '상품배분 결제액','상품배분 환불액','상품배분 순결제액','유료배송 결제건수',
     '상품배분 배송비','확인 상태','상품ID','관리자 주문내역 링크'],[25,16,33,29,21,17,19,22,22,23,20,20,19,40,70],4);
  const detail = products.flatMap(item=>item.money.orderRows.map(o=>({item,o})))
    .sort((a,b)=>String(b.o.paidAt).localeCompare(String(a.o.paidAt)) || a.o.orderNumber.localeCompare(b.o.orderNumber,'ko'));
  detail.forEach(({item,o})=>{
    const row=append(detailSheet,[
      kst(o.paidAt),item.p?.product_code||'',item.name,o.orderNumber,o.status,
      o.channel==='non_display'?'비전시':'전시',o.units,o.gross,o.refunds,
      o.review?'대조 필요':o.gross-o.refunds,o.shippingPaid?1:0,o.shipping,
      o.review?'금액 대조 필요':o.estimated?'배분 추정':'확인',item.id,
      'https://sanjipick.blendpunch.com/admin/orders/'+o.id,
    ],[8,9,10,12]);
    if(!o.review)row.getCell(10).value={formula:'H'+row.number+'-I'+row.number,result:o.gross-o.refunds};
  });
  return workbook;
}

export async function GET(request: Request) {
  const token=(await cookies()).get('admin_token')?.value;
  if(!token||!await verifyAdminToken(token)) return new Response('관리자 로그인이 필요합니다.',{status:401});
  const site=(await currentAdminSite()).key;
  if(site!=='sanjipick') return new Response('Not found',{status:404});
  const params=new URL(request.url).searchParams;
  if(params.getAll('from').length!==1||params.getAll('to').length!==1)
    return new Response('조회 시작일과 종료일을 하나씩 지정해주세요.',{status:400});
  const from=params.get('from')||'',to=params.get('to')||'';
  if(!from||!to||!validDateRange(from,to)||
    (Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))>366*86400000)
    return new Response('조회 날짜 또는 범위를 확인해주세요 (최대 1년).',{status:400});
  let client: PoolClient | null = null;
  try {
    client=await shopPool.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const raw=await rawTotals(client,from,to);
    const meta=await catalogAndHistory(client,from,to);
    const sold=await getProductSales('sanjipick',from,to,client);
    const financials=await getProductFinancials('sanjipick',from,to,undefined,client,true);
    await client.query('COMMIT');
    client.release();client=null;
    const book=generateWorkbook({from,to,total:raw.total,monthly:raw.monthly,
      sales:sold,financials,catalog:meta.catalog,snapshots:meta.snapshots});
    const buffer=await book.xlsx.writeBuffer();
    const filename='sanjipick_sales_'+from+'_'+to+'.xlsx';
    return new Response(new Uint8Array(buffer),{headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':'attachment; filename="'+filename+'"',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    }});
  } catch(error) {
    if(client) try{await client.query('ROLLBACK');}catch {/* read-only rollback best effort */}
    console.error('[admin/product-sales/export] failed',error);
    return new Response('엑셀 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.',{status:503});
  } finally {
    if(client)client.release();
  }
}
