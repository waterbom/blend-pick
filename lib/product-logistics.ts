import type { PoolClient } from 'pg';
export async function saveProductLogistics(c: PoolClient, id: string, b: Record<string, unknown>) {
    const fields = ['supplier_name', 'expected_ship_date'].filter(k => Object.hasOwn(b, k));
    if (!fields.length)
        return;
    await c.query(`UPDATE products_shop SET ${fields.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`, [id, ...fields.map(k => typeof b[k] === 'string' ? b[k].trim() || null : b[k] ?? null)]);
}
