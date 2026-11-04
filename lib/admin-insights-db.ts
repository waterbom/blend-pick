import shopPool from '@/lib/db-shop';
import type { SiteKey } from '@/lib/sites';
import { RETURN_REASONS } from '@/lib/returns';
import { AGE_BUCKETS, summarizeQueue, summarizeReturns, type QueueOrder, type ReturnInsightRecord, type ReturnListFilter, type ReturnRange } from '@/lib/admin-insights';

export async function getOrderQueueSummary(site: SiteKey, at = new Date().toISOString()) {
  const { rows } = await shopPool.query<QueueOrder>(`SELECT o.status,o.order_type,o.paid_at,
    COALESCE(o.payment_key LIKE 'SIM_%',false) AS test_payment,
    COALESCE(json_agg(json_build_object('product_id',oi.product_id,'product_name',oi.product_name,
      'expected_ship_date',to_jsonb(p)->>'expected_ship_date')) FILTER(WHERE oi.id IS NOT NULL),'[]'::json) AS items
    FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products_shop p ON p.id=oi.product_id
    WHERE o.site=$1 AND o.order_type IN ('shop','campaign') AND o.status IN ('paid','confirmed','preparing','shipped')
    AND COALESCE(o.payment_key,'') NOT LIKE 'SIM_%' GROUP BY o.id`, [site]);
  return summarizeQueue(rows, at);
}
export const completedAtSql = "(SELECT MIN(e.created_at) FROM order_return_events e WHERE e.return_id=r.id AND e.status='done' AND e.created_at>=r.created_at)";
export function returnWhere(site: SiteKey, filter: ReturnListFilter) {
  const params: unknown[] = [site];
  const parts = ["o.site=$1", "r.kind IN ('return','exchange')", "COALESCE(o.payment_key,'') NOT LIKE 'SIM_%'"];
  const bind = (value: unknown) => { params.push(value); return '$' + params.length; };
  if (filter.from) parts.push("r.created_at >= ("+bind(filter.from)+"::date::timestamp AT TIME ZONE 'Asia/Seoul')");
  if (filter.to) parts.push("r.created_at < (("+bind(filter.to)+"::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')");
  if (filter.kind !== 'all') parts.push('r.kind='+bind(filter.kind));
  if (filter.reason) {
    const index = ['change','defect','wrong','missing'].indexOf(filter.reason);
    parts.push(index >= 0 ? 'r.reason='+bind(RETURN_REASONS[index]) : "NOT COALESCE(r.reason=ANY("+bind(RETURN_REASONS.slice(0,4))+"::text[]),false)");
  }
  if (filter.status) parts.push(filter.status==='unknown' ? "r.status NOT IN ('requested','collecting','done','rejected')" : 'r.status='+bind(filter.status));
  if (filter.duration) {
    parts.push("r.status='done'");
    if (filter.duration==='unknown') parts.push(completedAtSql+' IS NULL');
    else {
      const bucket=AGE_BUCKETS.find(b=>b.key===filter.duration)!;
      const hours='EXTRACT(EPOCH FROM ('+completedAtSql+'-r.created_at))/3600';
      parts.push(hours+'>='+bind(bucket.start));
      if (bucket.end!==null) parts.push(hours+'<'+bind(bucket.end));
    }
  }
  return { sql: parts.join(' AND '), params };
}
export async function getReturnSummary(site: SiteKey, range: ReturnRange) {
  const where=returnWhere(site,range);
  const {rows}=await shopPool.query<ReturnInsightRecord>(`SELECT r.kind,r.reason,r.status,r.created_at,${completedAtSql} AS done_at
    FROM order_returns r JOIN orders o ON o.id=r.order_id WHERE ${where.sql}`,where.params);
  return summarizeReturns(rows);
}
export async function getReturnPage(site: SiteKey, filter: ReturnListFilter, page: number) {
  const where=returnWhere(site,filter), pageSize=50;
  const {rows}=await shopPool.query(`SELECT r.id,r.order_id,r.kind,r.status,r.items,r.reason,r.detail,r.photos,
    r.pickup_address,r.pickup_detail,r.fee_agreed,r.prev_status,r.created_at,
    to_char(r.created_at AT TIME ZONE 'Asia/Seoul','YYYY/MM/DD HH24:MI') AS created_kst,
    o.order_number,o.buyer_name,o.buyer_phone,o.recipient_name,o.recipient_phone,
    o.total_amount,COALESCE(o.shipping_fee,0) AS shipping_fee,o.status AS order_status,
    (SELECT COALESCE(MAX(ps.return_cost_roundtrip),0) FROM order_items oi JOIN products_shop ps ON ps.id=oi.product_id WHERE oi.order_id=r.order_id) AS return_cost_roundtrip,
    (SELECT json_agg(json_build_object('status',e.status,'note',e.note,'admin_name',e.admin_name,
      'at_kst',to_char(e.created_at AT TIME ZONE 'Asia/Seoul','YYYY/MM/DD HH24:MI')) ORDER BY e.created_at)
      FROM order_return_events e WHERE e.return_id=r.id) AS events,
    COUNT(*) OVER() AS total_count
    FROM order_returns r JOIN orders o ON o.id=r.order_id WHERE ${where.sql}
    ORDER BY r.created_at DESC,r.id DESC LIMIT 50 OFFSET $${where.params.length+1}`,[...where.params,(page-1)*pageSize]);
  const total=rows.length ? Number(rows[0].total_count) : Number((await shopPool.query(`SELECT COUNT(*) AS total FROM order_returns r JOIN orders o ON o.id=r.order_id WHERE ${where.sql}`,where.params)).rows[0].total);
  return {rows:rows.map(({total_count: _total,...row})=>row),total,page,pageSize};
}
