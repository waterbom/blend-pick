import shopPool from "@/lib/db-shop";
import { financialOrders, orderAmounts } from "@/lib/order-finance";
import type { SiteKey } from "@/lib/sites";

const kstDate = (value: string | Date) => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function settlementInPeriod(value: string | Date, period?: string, now = new Date()) {
    const day = kstDate(value), today = kstDate(now);
    if (period === 'today') return day === today;
    if (period === 'month') return day.slice(0, 7) === today.slice(0, 7);
    if (period === 'week') {
        const monday = new Date(today + 'T00:00:00Z');
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        return day >= monday.toISOString().slice(0, 10) && day <= today;
    }
    return true;
}
export function settlementTotal(rows: { settled_at: string | Date; net_amount: number | null }[], period?: string, now = new Date()): number | null {
    const selected = rows.filter(s => settlementInPeriod(s.settled_at, period, now));
    return selected.some(s => s.net_amount == null) ? null : selected.reduce((n, s) => n + Number(s.net_amount), 0);
}
export async function settlementView(site: SiteKey) {
    const [orders, records] = await Promise.all([financialOrders(site), shopPool.query('SELECT s.*,o.buyer_name FROM settlements s JOIN orders o ON o.id=s.order_id WHERE o.site=$1 ORDER BY s.settled_at DESC', [site])]);
    const map = new Map(orders.map(o => [o.id, o]));
    const seen = new Set<string>();
    return records.rows.filter(s => { if (seen.has(s.order_id))
        return false; seen.add(s.order_id); return true; }).map(s => {
        const o = map.get(s.order_id);
        if (!o)
            return { ...s, gross_amount: 0, fee: 0, net_amount: null, unresolved: true };
        const a = orderAmounts(o);
        return { ...s, order_number: o.order_number, site, gross_amount: a.net, fee: a.pgFee, net_amount: a.unresolved ? null : a.net - a.pgFee, unresolved: a.unresolved, fee_estimated: a.feeEstimated };
    });
}
