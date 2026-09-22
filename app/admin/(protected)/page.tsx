import AdminDashboardView from '@/components/admin/AdminDashboardView';
import { getSalesSummary } from '@/lib/sales-statistics';
import { currentAdminSite } from "@/lib/admin-site";
import { SITES, type SiteKey } from "@/lib/sites";
import shopPool from "@/lib/db-shop";


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
  const [counts, sales] = await Promise.all([getStats(site.key).catch(()=>null),getSalesSummary(site.key,days).catch(()=>null)]);
  const stats = counts ? {
    liveGongu:Number(counts.g.live_gongu), upcoming:Number(counts.g.upcoming),
    newOrders:Number(counts.q.new_orders), zeroStock:Number(counts.q.zero_stock),
    newReviews:Number(counts.q.new_reviews), todaySettlement:Number(counts.q.today_settlement),
  } : null;
  return <AdminDashboardView siteKey={site.key} siteName={site.name} date={kstToday()} stats={stats} sales={sales}/>;
}
