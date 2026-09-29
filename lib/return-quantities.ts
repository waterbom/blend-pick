import type { ReturnItem } from '@/lib/returns';
type Queryable = {query: (sql: string, params: unknown[]) => Promise<{rows: Record<string, any>[]}>};

// Exchanges replace goods; only completed returns consume the purchased quantity.
// Unknown legacy return quantities are held for review instead of guessed.
export async function returnableItems(db: Queryable, orderId: string): Promise<ReturnItem[]> {
    const original = (await db.query('SELECT id,product_name,option_label,unit_price,quantity FROM order_items WHERE order_id=$1 ORDER BY id', [orderId])).rows;
    const remaining = new Map(original.map(i => [String(i.id), Number(i.quantity)]));
    const completed = (await db.query("SELECT to_jsonb(r)->'items' AS items FROM order_returns r WHERE order_id=$1 AND kind='return' AND status='done'", [orderId])).rows;
    for (const ret of completed) {
        if (!Array.isArray(ret.items) || !ret.items.length) return [];
        for (const item of ret.items) {
            if (!remaining.has(String(item?.item_id)) || !Number.isSafeInteger(item?.quantity) || item.quantity < 1) return [];
            remaining.set(String(item.item_id), remaining.get(String(item.item_id))! - item.quantity);
        }
    }
    return original.map(i => ({item_id:String(i.id),product_name:String(i.product_name),option_label:i.option_label as string|null,unit_price:Number(i.unit_price),quantity:Math.max(0,remaining.get(String(i.id))!)})).filter(i=>i.quantity>0);
}
