import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";
import { estimatePaymentFee } from "@/lib/payment-fees.cjs";
import type { Pool, PoolClient } from 'pg';
export interface FinanceItem {
    id: string;
    product_id: string | null;
    product_ref: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    supply_price: number | null;
    commission_rate: number | null;
    tax_type: string | null;
}
export interface FinanceOrder {
    id: string;
    campaign_id: string | null;
    influencer_id: string | null;
    influencer_name: string | null;
    order_type: string;
    status: string;
    order_number: string;
    paid_at: string;
    total_amount: number;
    shipping_fee: number;
    commission_rate: number | null;
    payment_method: string;
    sales_channel: string;
    refund_amount_unresolved: boolean;
    refunds: number;
    refund_count: number;
    pending_refunds: boolean;
    actual_fee: number | null;
    fee_estimated: boolean;
    items: FinanceItem[];
}
export async function financialOrders(site: SiteKey, from?: string | null, to?: string | null, db: Pool | PoolClient = shopPool, influencerId?: string): Promise<FinanceOrder[]> {
    const args: unknown[] = [site];
    if (influencerId) args.push(influencerId);
    const filters = ["o.site=$1", "o.paid_at IS NOT NULL", "o.payment_key IS NOT NULL", "o.payment_key NOT LIKE 'SIM_%'"];
    if (influencerId) filters.push('o.influencer_id=$2');
    if (from) {
        args.push(from);
        filters.push(`o.paid_at >= ($${args.length}::date::timestamp AT TIME ZONE 'Asia/Seoul')`);
    }
    if (to) {
        args.push(to);
        filters.push(`o.paid_at < (($${args.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')`);
    }
    const { rows } = await db.query(`SELECT o.*,
  EXISTS(SELECT 1 FROM refund_operations ro WHERE ro.order_id=o.id AND ro.status NOT IN ('completed','rejected')) AS pending_refunds,
  COALESCE(r.amount,0)::bigint AS refunds, COALESCE(r.n,0)::int AS refund_count,
  s.fee AS actual_fee, COALESCE(s.fee_estimated,true) AS fee_estimated,
  COALESCE(i.items,'[]'::jsonb) AS items
  FROM orders o
  LEFT JOIN LATERAL (SELECT SUM(amount) AS amount,COUNT(*) AS n FROM order_refund_amounts WHERE order_id=o.id) r ON true
  LEFT JOIN LATERAL (SELECT fee,fee_estimated FROM settlements WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) s ON true
  LEFT JOIN LATERAL (SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.id) AS items FROM order_items oi WHERE oi.order_id=o.id) i ON true
  WHERE ${filters.join(' AND ')} ORDER BY o.paid_at,o.id`, args);
    return rows;
}
// Integer allocation preserves the order total even when a refund/discount cannot divide evenly.
export function allocate(total: number, weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
    if (!sum)
        return weights.map(() => 0);
    const raw = weights.map(w => total * Math.max(0, w) / sum), result = raw.map(Math.floor);
    const ranks = raw.map((v, i) => ({ i, part: v - result[i] })).sort((a, b) => b.part - a.part || a.i - b.i);
    for (let n = total - result.reduce((a, b) => a + b, 0), i = 0; i < n; i++)
        result[ranks[i % ranks.length].i]++;
    return result;
}
export function orderAmounts(o: FinanceOrder) {
    const total = Number(o.total_amount), refund = Number(o.refunds), shipping = Number(o.shipping_fee || 0);
    const unresolved = !!o.pending_refunds || !!o.refund_amount_unresolved || refund > total ||
        (['cancelled', 'return_completed'].includes(o.status) && !Number(o.refund_count));
    const net = Math.max(0, total - refund);
    // Legacy refunds only carry an order amount: reduce merchandise first, then shipping.
    // Item-specific refund allocation is not available; multiple products share the reduction by value.
    const goods = Math.max(0, total - shipping - refund);
    const weights = o.items.map(i => Number(i.unit_price) * Number(i.quantity));
    const amounts = allocate(goods, weights);
    const lines = o.items.map((i, n) => {
        const rate = i.commission_rate ?? o.commission_rate;
        const gross = amounts[n];
        return { ...i, gross, rate: rate == null ? null : Number(rate),
            commission: !o.influencer_id ? 0 : rate == null ? null : Math.round(gross * Number(rate) / 100),
            vat: i.tax_type === 'exempt' ? 0 : i.tax_type === 'taxable' ? Math.round(gross / 11) : null };
    });
    const pgFee = o.fee_estimated || o.actual_fee == null ? estimatePaymentFee(net, o.payment_method) : Number(o.actual_fee);
    return { total, refund, net, goods, unresolved, lines, pgFee, feeEstimated: o.fee_estimated || o.actual_fee == null };
}
export function validDateRange(from: string | null, to: string | null) {
    const valid = (s: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
    return valid(from) && valid(to) && (!from || !to || from <= to);
}
