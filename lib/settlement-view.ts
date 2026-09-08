import shopPool from "@/lib/db-shop";
import { financialOrders, orderAmounts } from "@/lib/order-finance";
import type { SiteKey } from "@/lib/sites";
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
