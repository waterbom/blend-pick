import shopPool from "@/lib/db-shop";
import Link from "next/link";

// 대시보드 — KPI 스트립(오늘 매출·주문·진행 공구·정산액) + 처리 대기 큐
async function getStats() {
  const [kpi, gongu, queue] = await Promise.all([
    shopPool.query(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (
          WHERE (paid_at AT TIME ZONE 'Asia/Seoul')::date = (NOW() AT TIME ZONE 'Asia/Seoul')::date
            AND status <> 'cancelled'), 0) AS today_sales,
        COUNT(*) FILTER (
          WHERE (paid_at AT TIME ZONE 'Asia/Seoul')::date = (NOW() AT TIME ZONE 'Asia/Seoul')::date) AS today_orders,
        COUNT(*) FILTER (
          WHERE (paid_at AT TIME ZONE 'Asia/Seoul')::date = (NOW() AT TIME ZONE 'Asia/Seoul')::date
            AND status = 'cancelled') AS today_cancels
      FROM orders
    `),
    shopPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND sale_type = 'groupbuy'
          AND (sale_start_at IS NULL OR sale_start_at <= NOW())
          AND (sale_end_at IS NULL OR sale_end_at >= NOW())) AS live_gongu,
        COUNT(*) FILTER (WHERE status = 'active' AND sale_start_at > NOW()) AS upcoming
      FROM products_shop
    `),
    shopPool.query(`
      SELECT
        (SELECT COUNT(*) FROM orders WHERE status = 'paid' AND order_type = 'shop') AS new_orders,
        (SELECT COUNT(*) FROM products_shop WHERE status = 'active' AND stock = 0) AS zero_stock,
        (SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '7 days') AS new_reviews,
        (SELECT COALESCE(SUM(net_amount), 0) FROM settlements
          WHERE settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date) AS today_settlement
    `),
  ]);
  return { k: kpi.rows[0], g: gongu.rows[0], q: queue.rows[0] };
}

const kstToday = () =>
  new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ". ");

export default async function AdminDashboard() {
  const { k, g, q } = await getStats();

  const kpis = [
    { label: "오늘 매출", value: `${Number(k.today_sales).toLocaleString()}원`, sub: `취소 ${Number(k.today_cancels)}건 포함` },
    { label: "오늘 주문", value: `${Number(k.today_orders)}건`, sub: "결제 기준" },
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
        <h1 className="text-xl font-bold" style={{ color: "#1A1D18" }}>대시보드</h1>
        <span className="ds-mono text-xs" style={{ color: "#8F948A" }}>{kstToday()} 기준</span>
      </div>

      {/* KPI 스트립 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#E2E2DC", border: "1px solid #E2E2DC" }}>
        {kpis.map((c) => (
          <div key={c.label} className="bg-white p-5">
            <p className="ds-mono text-[10px] mb-2.5" style={{ letterSpacing: "0.2em", color: "#8F948A" }}>{c.label}</p>
            <p className="text-2xl font-extrabold tnum" style={{ color: "#1A1D18" }}>{c.value}</p>
            <p className="text-xs mt-1" style={{ color: "#8F948A" }}>{c.sub}</p>
          </div>
        ))}
      </div>

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
