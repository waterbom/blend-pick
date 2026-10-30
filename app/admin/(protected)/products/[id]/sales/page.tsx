import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import shopPool from '@/lib/db-shop';
import { currentAdminSite, adminProductScopeSql } from '@/lib/admin-site';
import { validDateRange } from '@/lib/order-finance';
import { getProductFinancials, emptyProductMoney } from '@/lib/product-financials';
import { getProductSales, emptySalesCounts, type ProductSales } from '@/lib/product-sales';

const money = (value: number) => value.toLocaleString('ko-KR') + '원';
const date = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default async function ProductFinancialReport({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const token = (await cookies()).get('admin_token')?.value;
  if (!token || !await verifyAdminToken(token)) redirect('/login');
  const site = (await currentAdminSite()).key;
  const { id } = await params;
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) notFound();
  const scope = adminProductScopeSql(site, 'category', 2);
  const { rows } = await shopPool.query(
    'SELECT id,name,product_code,sale_type,sale_start_at,sale_end_at,status,is_visible,archived_at FROM products_shop WHERE id=$1 AND ' + scope.sql,
    [id, scope.param],
  );
  const product = rows[0];
  if (!product) notFound();
  const q = await searchParams;
  const from = typeof q.from === 'string' ? q.from : product.sale_type === 'groupbuy' && product.sale_start_at
    ? new Date(product.sale_start_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : '';
  const to = typeof q.to === 'string' ? q.to : product.sale_type === 'groupbuy' && product.sale_end_at
    ? new Date(product.sale_end_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) : '';
  const valid = validDateRange(from || null, to || null) && (q.from === undefined || typeof q.from === 'string') && (q.to === undefined || typeof q.to === 'string');
  let report = emptyProductMoney(), quantities: ProductSales = { ...emptySalesCounts(), options: [] };
  let error = '';
  if (!valid) error = '조회 기간을 확인해주세요.';
  else {
    try {
      const [financials, sales] = await Promise.all([
        getProductFinancials(site, from, to, id), getProductSales(site, from, to),
      ]);
      report = financials.get(id) ?? emptyProductMoney();
      quantities = sales.get(id) ?? { ...emptySalesCounts(), options: [] };
    } catch (e) {
      console.error('[admin/products/sales] lookup failed', e);
      error = '결제·환불 내역을 조회하지 못했습니다.';
    }
  }
  const back = '/admin/products?f=all&' + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  return <div className="ops-workspace space-y-5">
    <header className="ops-page-heading"><div>
      <Link href={back} className="text-sm text-[#2D5A27]">← 상품 목록</Link>
      <h1 className="mt-2">{product.name} · 공구 판매 실적</h1>
      <p>{product.product_code || '코드 없음'} · {product.sale_type === 'groupbuy' ? '공동구매' : '상시 판매'} · {product.is_visible === false ? '비전시 상품' : '전시 상품'} · {product.archived_at ? '보관된 상품' : product.status}</p>
    </div><Link href={'/admin/products/' + id} className="ops-button">상품 설정</Link></header>
    <section className="ops-list-panel p-4">
      <form className="ops-product-filters" action={'/admin/products/' + id + '/sales'}>
        <div className="ops-period-row"><strong>결제일 기준 (한국시간)</strong><label>시작 <input name="from" type="date" defaultValue={from}/></label><label>종료 <input name="to" type="date" defaultValue={to}/></label><button className="ops-button ops-button-primary">조회</button></div>
      </form>
      <p className="text-xs text-gray-500 mt-2">결제일이 조회 기간에 포함된 주문의 현재까지 발생한 환불액을 반영합니다. 전시·비전시 전환이나 공구 종료 이후에도 주문 기록은 포함됩니다.</p>
    </section>
    {error ? <p role="alert" className="ops-warning">{error}</p> : <>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="상품 실적 요약">
        {[
          ['결제 주문', report.orders.toLocaleString() + '건'],
          ['주문 수량', report.units.toLocaleString() + '개'],
          ['실판매 수량', quantities.sold.toLocaleString() + '개'],
          ['총 결제액', money(report.gross)],
          ['확인된 환불액', money(report.refunds)],
          ['순 결제액', report.net == null ? '확인 필요' : money(report.net)],
          ['유료배송 결제', report.shippingPayments.toLocaleString() + '건'],
          ['배분 배송비', money(report.shipping)],
        ].map(([label, value]) => <div className="border border-gray-200 bg-white p-4" key={label}><p className="text-sm text-gray-500">{label}</p><p className="text-lg font-semibold mt-1 ds-mono">{value}</p></div>)}
      </section>
      <section className="ops-sales-summary"><strong>결제 당시 유입 경로</strong><span>전시 <b>{report.displayOrders}건</b></span><span>비전시 <b>{report.nonDisplayOrders}건</b></span><span>여러 상품 혼합 주문 <b>{report.allocatedOrders}건</b></span>{report.review > 0 && <span className="ops-warning">금액 확인 필요 {report.review}건</span>}</section>
      <section className="ops-list-panel"><div className="p-4"><h2 className="font-bold">주문별 결제·환불·배송비 내역</h2><p className="text-xs text-gray-500">한 주문에 여러 상품이 담긴 경우 원결제액·배송비·환불액을 주문 당시 금액 비중으로 배분합니다. 송장 개수와 배송비 결제 건수는 다릅니다.</p></div>
      {!report.orderRows.length ? <p className="ops-empty">조회 기간에 결제된 주문이 없습니다.</p> : <div className="ops-table-scroll"><table className="ops-table">
        <thead><tr><th>주문번호 · 결제일</th><th>경로 · 상태</th><th>주문수량</th><th>배분 결제액</th><th>배분 환불액</th><th>유료배송</th><th>비고</th></tr></thead>
        <tbody>{report.orderRows.map(o => <tr key={o.id}>
          <td><Link className="font-semibold text-[#2D5A27] underline" href={'/admin/orders/' + o.id}>{o.orderNumber}</Link><span className="ops-meta">{date(o.paidAt)}</span></td>
          <td>{o.channel === 'non_display' ? '비전시' : '전시'}<span className="ops-meta">{o.status}</span></td>
          <td>{o.units.toLocaleString()}개</td><td>{money(o.gross)}</td><td>{money(o.refunds)}</td>
          <td>{o.shippingPaid ? '결제 1건 · ' + money(o.shipping) : '무료'}</td>
          <td>{o.review ? <span className="ops-warning">대조 필요</span> : o.estimated ? '금액 배분' : '직접 집계'}</td>
        </tr>)}</tbody></table></div>}
      </section>
      <p className="text-xs text-gray-500">결제 금액에는 배송비가 포함됩니다. 배송비 결제 건수는 해당 상품이 담긴 유료배송 주문 수이므로 다른 상품의 건수와 합산하면 중복될 수 있습니다. 환불 처리 중·기록 불일치 주문은 순 결제액을 확정하지 않습니다. 환불 시점이 아니라 결제일 기준으로 조회합니다.</p>
    </>}
  </div>;
}
