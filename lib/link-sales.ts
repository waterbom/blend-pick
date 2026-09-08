import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";
// Orders are grouped before joining item/refund totals: multiple options never multiply revenue.
export async function getLinkSales(site: SiteKey, start: string, end: string) {
  const {rows}=await shopPool.query(`
    WITH picked AS (
      SELECT * FROM orders WHERE site=$1 AND order_type='shop' AND paid_at >= $2::timestamptz
        AND paid_at < $3::timestamptz AND payment_key IS NOT NULL AND payment_key NOT LIKE 'SIM_%'
    ), qty AS (
      SELECT i.order_id, SUM(i.quantity)::int AS units FROM order_items i JOIN picked p ON p.id=i.order_id GROUP BY i.order_id
    ), refunds AS (
      SELECT r.order_id, SUM(r.amount)::bigint AS amount FROM order_refund_amounts r JOIN picked p ON p.id=r.order_id GROUP BY r.order_id
    )
    SELECT p.sales_channel, COUNT(*)::int AS orders, SUM(COALESCE(q.units,0))::bigint AS units,
      SUM(p.total_amount)::bigint AS gross, SUM(COALESCE(r.amount,0))::bigint AS refunds,
      COUNT(*) FILTER (WHERE p.refund_amount_unresolved OR (p.status IN ('cancelled','return_completed') AND r.order_id IS NULL)
        OR COALESCE(r.amount,0)>p.total_amount)::int AS unresolved,
      SUM(p.total_amount-COALESCE(r.amount,0))::bigint AS net
    FROM picked p LEFT JOIN qty q ON q.order_id=p.id LEFT JOIN refunds r ON r.order_id=p.id
    GROUP BY p.sales_channel ORDER BY p.sales_channel`, [site,start,end]);
  return rows as {sales_channel:string;orders:number;units:string;gross:string;refunds:string;unresolved:number;net:string}[];
}
