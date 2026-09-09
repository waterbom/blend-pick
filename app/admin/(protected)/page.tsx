import SalesCharts from '@/components/admin/charts/SalesCharts';
import { getSalesSummary } from '@/lib/sales-statistics';
import { currentAdminSite } from "@/lib/admin-site";
import { SITES, type SiteKey } from "@/lib/sites";
import shopPool from "@/lib/db-shop";
import Link from "next/link";

// 대시보드 — KPI 스트립(오늘 매출·주문·진행 공구·정산액) + 처리 대기 큐
async function getStats(site: SiteKey) {
  const [gongu, queue] = await Promise.all([
    shopPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND sale_type = 'groupbuy'
          AND (sale_start_at IS NULL OR sale_start_at <= NOW())
          AND (sale_end_at IS NULL OR sale_end_at >= NOW())) AS live_gongu,
        COUNT(*) FILTER (WHERE status = 'active' AND sale_start_at > NOW()) AS upcoming
      FROM products_shop
      WHERE CASE WHEN $1 = 'sanjipick' THEN category = ANY($2::text[]) ELSE NOT COALESCE(category = ANY($2::text[]), false) END
    `, [site, SITES.sanjipick.categories]),
    shopPool.query(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE site = $1 AND status = 'paid' AND order_type IN ('shop', 'campaign')) AS new_orders,
        (SELECT COUNT(*) FROM products_shop WHERE status = 'active' AND stock = 0 AND CASE WHEN $1 = 'sanjipick' THEN category = ANY($2::text[]) ELSE NOT COALESCE(category = ANY($2::text[]), false) END) AS zero_stock,
        (SELECT COUNT(*) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.site = $1 AND r.created_at >= NOW() - INTERVAL '7 days') AS new_reviews,
        (SELECT COALESCE(SUM(net_amount), 0) FROM settlements s JOIN orders o ON o.id = s.order_id
          WHERE o.site = $1 AND s.settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date) AS today_settlement
    `, [site, SITES.sanjipick.categories]),
  ]);
  return { g: gongu.rows[0], q: queue.rows[0] };
}

const kstToday = () =>
  new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ". ");

export default async function AdminDashboard({searchParams}:{searchParams:Promise<{days?:string}>}) {
  const site = await currentAdminSite();
  const params = await searchParams;
  const days = ["1","7","30"].includes(params.days || "") ? Number(params.days) : 7;
  const [{g,q}, sales] = await Promise.all([getStats(site.key),getSalesSummary(site.key,days).catch(()=>null)]);

  const today = sales?.daily.at(-1);
  const kpis = [
    { label: "오늘 순 결제액", value: today?.net == null ? "확인 필요" : `${today.net.toLocaleString()}원`, sub: "배송비 포함 · 확인된 환불 반영" },
    { label: "오늘 주문", value: today ? `${today.orders}건` : "—", sub: "실제 결제 기준 · 테스트 제외" },
    { label: "진행 중 공구", value: `${Number(g.live_gongu)}건`, sub: `오픈 예정 ${Number(g.upcoming)}건` },
    { label: "오늘 정산액", value: `${Number(q.today_settlement).toLocaleString()}원`, sub: "배송완료 기준" },
  ];

  const queue = [
    { label: "신규 주문 확인", value: Number(q.new_orders), href: "/admin/orders" },
    { label: "재고 0 · 판매중 상품", value: Number(q.zero_stock), href: "/admin/products", warn: true },
    { label: "최근 7일 새 리뷰", value: Number(q.new_reviews), href: "/admin/reviews" },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#1A1D18" }}>{site.name} 운영 요약</h1>
        <span className="ds-mono text-xs" style={{ color: "#8F948A" }}>{kstToday()} 기준</span>
      </div>

      <Link href="/admin/operations" className="block mb-6 rounded-lg bg-[#244B1F] px-5 py-4 text-white">오늘 처리할 일 · 미출고, 송장 누락, 재고, 교환·반품 확인 →</Link>

      <nav aria-label="자주 처리하는 업무" className="commerce-flow-links"><Link href="/admin/products/new">상품 등록</Link><Link href="/admin/orders">주문 확인</Link><Link href="/admin/shipments">출고·송장 처리</Link><Link href="/admin/settlements">결제 정산</Link></nav>
      {/* KPI 스트립 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#E2E2DC", border: "1px solid #E2E2DC" }}>
        {kpis.map((c) => (
          <div key={c.label} className="bg-white p-5">
            <p className="ds-mono text-xs mb-2.5" style={{ letterSpacing: "0.2em", color: "#8F948A" }}>{c.label}</p>
            <p className="text-2xl font-extrabold tnum" style={{ color: "#1A1D18" }}>{c.value}</p>
            <p className="text-xs mt-1" style={{ color: "#8F948A" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {sales ? <SalesCharts data={sales}/> : <p role="alert" className="my-6 rounded-lg bg-amber-50 p-4 text-sm">매출 그래프를 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.</p>}

      {/* 처리 대기 큐 */}
      <div className="mt-6 bg-white" style={{ border: "1px solid #E2E2DC" }}>
        <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: "1px solid #E2E2DC" }}>
          <span className="font-bold text-sm" style={{ color: "#1A1D18" }}>처리 대기</span>
          <span className="ds-mono text-xs" style={{ color: "#A6412F" }}>
            {queue.reduce((s, i) => s + i.value, 0)}건
          </span>
        </div>
        {queue.map((item, i) => (
          <Link key={item.label} href={item.href}
            className="flex justify-between items-center px-6 py-3.5 text-[13px] hover:bg-[#F4F4F1] transition-colors"
            style={{ borderTop: i > 0 ? "1px solid #F0F0EB" : "none", color: "#3E423A" }}>
            <span>{item.label}</span>
            <span className="ds-mono font-semibold" style={{ color: item.warn && item.value > 0 ? "#A6412F" : "#1A1D18" }}>
              {item.value}
            </span>
          </Link>
        ))}
        <p className="px-6 py-3 text-[11px]" style={{ borderTop: "1px solid #F0F0EB", color: "#8F948A" }}>
          항목을 누르면 해당 관리 화면으로 이동합니다.
        </p>
      </div>
    </div>
  );
}
