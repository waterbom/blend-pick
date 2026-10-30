import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite, adminProductScopeSql } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
import { validDateRange } from '@/lib/order-finance';
import { getProductSales, emptySalesCounts } from '@/lib/product-sales';
import { getProductFinancials, emptyProductMoney } from '@/lib/product-financials';
import { productStage } from '@/lib/admin-workflow';

export const dynamic = 'force-dynamic';

type SalesFilters = { from?: string; to?: string; q?: string; stage?: string; visibility?: string; sale?: string };
type ReportProduct = {
  id: string; name: string; brand: string | null; category: string | null;
  product_code: string | null; sale_type: string | null;
  sale_start_at: string | null; sale_end_at: string | null;
  status: string; stock: number; is_visible: boolean | null; archived_at: string | null;
};
const number = (value: number) => value.toLocaleString('ko-KR');
const won = (value: number) => number(value) + '원';
const day = (value: string | null) => value
  ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  : '미지정';
const fmt = (value: number, label: string) => number(value) + label;

export default async function SanjipickProductSalesPage({ searchParams }: {
  searchParams: Promise<SalesFilters>;
}) {
  const token = (await cookies()).get('admin_token')?.value;
  if (!token || !await verifyAdminToken(token)) redirect('/login');
  const site = await currentAdminSite();
  // The dedicated report is only offered on the Sanjipick host. No query override.
  if (site.key !== 'sanjipick') notFound();

  const raw = await searchParams;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const from = typeof raw.from === 'string' ? raw.from : today.slice(0, 8) + '01';
  const to = typeof raw.to === 'string' ? raw.to : today;
  const stage = ['all', 'selling', 'ready', 'closed'].includes(raw.stage || '') ? raw.stage : 'all';
  const visibility = ['all', 'shown', 'hidden'].includes(raw.visibility || '') ? raw.visibility : 'all';
  const sale = ['all', 'groupbuy', 'always'].includes(raw.sale || '') ? raw.sale : 'all';
  const search = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '';
  const invalid = (raw.from !== undefined && typeof raw.from !== 'string')
    || (raw.to !== undefined && typeof raw.to !== 'string')
    || !validDateRange(from, to);

  let products: ReportProduct[] = [];
  let sales = new Map<string, Awaited<ReturnType<typeof getProductSales>> extends Map<string, infer V> ? V : never>();
  let financials = new Map<string, Awaited<ReturnType<typeof getProductFinancials>> extends Map<string, infer V> ? V : never>();
  let error = invalid ? '조회 날짜를 확인해주세요. 시작일은 종료일 이후일 수 없습니다.' : '';
  if (!error) {
    try {
      const scope = adminProductScopeSql(site.key, 'category', 1);
      const [catalog, sold, money] = await Promise.all([
        shopPool.query<ReportProduct>(`SELECT id,name,brand,category,product_code,sale_type,sale_start_at,sale_end_at,
          status,stock,is_visible,archived_at FROM products_shop
          WHERE ${scope.sql} ORDER BY created_at DESC`, [scope.param]),
        getProductSales(site.key, from, to),
        getProductFinancials(site.key, from, to),
      ]);
      products = catalog.rows;
      sales = sold;
      financials = money;
    } catch (e) {
      console.error('[admin/product-sales] lookup failed', e);
      error = '상품별 판매실적을 불러오지 못했습니다. 다시 조회해주세요.';
    }
  }

  const now = Date.now();
  const rows = products.filter(p => {
    const productState = p.archived_at ? 'closed' : productStage(p, now);
    if (stage !== 'all' && productState !== stage) return false;
    if (visibility === 'shown' && p.is_visible === false) return false;
    if (visibility === 'hidden' && p.is_visible !== false) return false;
    if (sale !== 'all' && (p.sale_type || 'always') !== sale) return false;
    const haystack = [p.name, p.brand, p.product_code, p.category].join(' ').toLowerCase();
    return !search || haystack.includes(search.toLowerCase());
  });
  const total = rows.reduce((a, p) => {
    const units = sales.get(p.id) || { ...emptySalesCounts(), options: [] };
    const money = financials.get(p.id) || emptyProductMoney();
    a.orders += money.orders; a.units += units.sold;
    a.gross += money.gross; a.refunds += money.refunds;
    a.shipping += money.shipping; a.shippingPayments += money.shippingPayments;
    a.unresolved += money.review;
    if (money.net === null) a.netValid = false;
    else a.net += money.net;
    return a;
  }, { orders: 0, units: 0, gross: 0, refunds: 0, shipping: 0,
    shippingPayments: 0, unresolved: 0, net: 0, netValid: true });

  return <div className="ops-workspace">
    <header className="ops-page-heading">
      <div><h1>상품별 판매실적</h1>
        <p>산지픽 · 판매 종료와 비전시 상품까지 주문 당시 결제 기준으로 조회합니다.</p>
      </div>
      <div className="ops-heading-actions"><Link href="/admin/products?f=all" className="ops-text-button">상품 관리</Link></div>
    </header>
    <section className="ops-list-panel" aria-label="상품별 판매실적 검색">
      <form action="/admin/product-sales" className="ops-product-filters">
        <div className="ops-period-row">
          <strong>결제일 조회 기간</strong>
          <label>시작 <input name="from" type="date" defaultValue={from}/></label>
          <label>종료 <input name="to" type="date" defaultValue={to}/></label>
          <small>한국시간 · 시작일과 종료일 포함</small>
        </div>
        <div className="ops-toolbar">
          <input className="ops-search" name="q" aria-label="상품 검색" defaultValue={search} placeholder="상품명 · 브랜드 · 상품코드 검색"/>
          <select name="stage" defaultValue={stage} aria-label="판매 상태">
            <option value="all">판매 상태 전체</option>
            <option value="selling">판매 중</option>
            <option value="ready">판매 준비</option>
            <option value="closed">판매 종료·보관</option>
          </select>
          <select name="visibility" defaultValue={visibility} aria-label="현재 전시 상태">
            <option value="all">전시·비전시 전체</option>
            <option value="shown">현재 전시</option>
            <option value="hidden">현재 비전시</option>
          </select>
          <select name="sale" defaultValue={sale} aria-label="판매 방식">
            <option value="all">판매 방식 전체</option>
            <option value="groupbuy">공동구매</option>
            <option value="always">상시 판매</option>
          </select>
          <button className="ops-button ops-button-primary">조회</button>
          <Link href="/admin/product-sales" className="ops-text-button">초기화</Link>
        </div>
      </form>
    </section>
    {error ? <section className="ops-list-panel"><p className="ops-warning p-4" role="alert">{error}</p></section>
    : <>
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="선택 기간 판매 요약">
        {[
          ['조회 상품', fmt(rows.length, '개')],
          ['상품별 결제 주문', fmt(total.orders, '건')],
          ['실판매 수량', fmt(total.units, '개')],
          ['총 결제액', won(total.gross)],
          ['확인된 환불액', won(total.refunds)],
          ['순 결제액', total.netValid ? won(total.net) : '대조 필요'],
          ['유료배송 결제', fmt(total.shippingPayments, '건')],
          ['배분 배송비', won(total.shipping)],
        ].map(([label, value]) => <div key={label} className="border border-gray-200 bg-white rounded-lg p-4 min-w-0">
          <p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-bold text-lg break-words ds-mono">{value}</p>
        </div>)}
      </section>
      <section className="ops-list-panel" aria-label="상품별 실적 목록">
        <div className="ops-sales-summary">
          <strong>{rows.length}개 상품 · {from} ~ {to}</strong>
          <span>전시·비전시 구매 경로는 주문 당시 기록 기준</span>
          {total.unresolved > 0 && <span className="ops-warning">금액 대조 필요 {total.unresolved}건</span>}
        </div>
        {!rows.length ? <p className="ops-empty">조회 조건에 맞는 상품이 없습니다.</p>
        : <div className="ops-table-scroll"><table className="ops-table ops-products-table">
          <thead><tr><th>상품 · 코드</th><th>판매 기간 · 상태</th><th>주문 · 실판매</th><th>결제 당시 경로</th>
            <th>총 결제액</th><th>확인된 환불액</th><th>순 결제액</th><th>유료배송 건수 · 금액</th><th>상세</th></tr></thead>
          <tbody>{rows.map(p => {
            const counts = sales.get(p.id) || { ...emptySalesCounts(), options: [] };
            const m = financials.get(p.id) || emptyProductMoney();
            const productState = p.archived_at ? '보관' : productStage(p, now) === 'closed' ? '판매 종료' : productStage(p, now) === 'ready' ? '판매 준비' : '판매 중';
            const detail = '/admin/products/' + p.id + '/sales?' + new URLSearchParams({ from, to }).toString();
            return <tr key={p.id}>
              <td><Link href={detail} className="font-semibold text-[#2D5A27] underline">{p.name}</Link>
                <span className="ops-meta">{[p.product_code, p.brand, p.category].filter(Boolean).join(' · ')}</span>
                <span className="ops-meta">{p.is_visible === false ? '현재 비전시' : '현재 전시'} · {p.sale_type === 'groupbuy' ? '공동구매' : '상시 판매'}</span>
              </td>
              <td><span className="ops-meta">{day(p.sale_start_at)} ~ {day(p.sale_end_at)}</span>
                <strong className="ops-meta">{productState}</strong>
              </td>
              <td><strong>{fmt(m.orders, '건')}</strong><span className="ops-meta">결제 {fmt(counts.paid, '개')} · 판매 {fmt(counts.sold, '개')}</span></td>
              <td>전시 {fmt(m.displayOrders, '건')}<span className="ops-meta">비전시 {fmt(m.nonDisplayOrders, '건')}</span></td>
              <td><strong>{won(m.gross)}</strong></td>
              <td>{won(m.refunds)}</td>
              <td>{m.net === null ? <span className="ops-warning">대조 필요</span> : <strong>{won(m.net)}</strong>}</td>
              <td>{fmt(m.shippingPayments, '건')}<span className="ops-meta">{won(m.shipping)}</span></td>
              <td><Link href={detail} className="ops-text-button">주문 상세</Link></td>
            </tr>;
          })}</tbody>
        </table></div>}
      </section>
      <p className="text-xs text-gray-500">
        주문일이 아닌 결제일 기준이며 환불액은 현재까지 확정된 내역입니다. 상품별 주문·유료배송 건수는 한 주문에 여러 상품이 포함되면 중복될 수 있어 상품 간 단순 합계가 실제 주문 건수와 다를 수 있습니다.
        상품별 결제액·배송비는 주문 내 상품 비중으로 배분합니다. 환불이 미확정인 경우 순 결제액을 확정 표시하지 않습니다.
      </p>
    </>}
  </div>;
}
