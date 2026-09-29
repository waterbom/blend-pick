import { rollbackSafely, ApiError, statusErrorCode } from '@/lib/api-errors';
import shopPool from '@/lib/db-shop';
import { dispatchIssues } from '@/lib/admin-workflow';
export class DispatchError extends ApiError {
    constructor(message: string, status = 409) { super(statusErrorCode(status), message, status); }
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const exportFields = ['id', 'order_number', 'status', 'order_type', 'site', 'buyer_name', 'buyer_phone', 'recipient_name', 'recipient_phone', 'addr_zipcode', 'addr_address', 'addr_detail', 'addr_memo', 'total_amount', 'shipping_fee', 'influencer_name', 'link_code', 'sales_channel', 'created_at'];
const exportOrder = (o: Record<string, unknown>, items: unknown[]) => Object.fromEntries([...exportFields.map(k => [k, o[k]]), ['items', items]]);

// Historical batches remain immutable. Supplier downloads use a fresh eligibility check.
export async function currentDispatchExport(site: string, ids: unknown, historical?: Record<string, unknown>[]) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length)
        throw new DispatchError('주문 선택을 확인해주세요.', 400);
    const { rows } = await shopPool.query(`SELECT o.*,
        EXISTS(SELECT 1 FROM refund_operations r WHERE r.order_id=o.id AND r.status NOT IN ('completed','rejected')) AS pending_refunds,
        COALESCE((SELECT jsonb_agg(to_jsonb(oi) || jsonb_build_object('supplier_name',p.supplier_name,'expected_ship_date',p.expected_ship_date,'product_code',p.product_code) ORDER BY oi.id)
          FROM order_items oi LEFT JOIN products_shop p ON p.id=oi.product_id WHERE oi.order_id=o.id),'[]'::jsonb) AS items
        FROM orders o WHERE o.site=$1 AND o.id=ANY($2::uuid[]) ORDER BY o.id`, [site, ids]);
    if (rows.length !== ids.length) throw new DispatchError('현재 사이트의 주문을 찾을 수 없습니다.', 404);
    const snapshot: Record<string, unknown>[] = [], excluded: {order_number:string;reason:string}[] = [];
    for (const o of rows) {
        if (o.status !== 'preparing' || o.pending_refunds || !['shop','campaign'].includes(o.order_type)) {
            excluded.push({order_number:o.order_number,reason:o.pending_refunds?'환불 처리 중':`현재 상태: ${o.status}`});
        } else {
            const original = historical?.find(v => v.id === o.id);
            snapshot.push(original ? {...original,status:o.status} : exportOrder(o,o.items));
        }
    }
    return {snapshot,excluded};
}
export async function confirmDispatch(site: string, key: unknown, ids: unknown) {
    if (!uuid(key) || !Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length)
        throw new DispatchError('주문 선택과 요청 번호를 확인해주세요.', 400);
    const orderIds = [...ids].sort();
    const c = await shopPool.connect();
    try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [site + ':dispatch:' + key]);
        const previous = await c.query('SELECT * FROM admin_dispatch_batches WHERE site=$1 AND request_key=$2', [site, key]);
        if (previous.rows.length) {
            const batch = previous.rows[0];
            if (JSON.stringify([...batch.order_ids].sort()) !== JSON.stringify(orderIds))
                throw new DispatchError('같은 요청 번호로 주문을 바꿀 수 없습니다.');
            await c.query('COMMIT');
            return batch;
        }
        const r = await c.query(`SELECT o.*,EXISTS(SELECT 1 FROM refund_operations r WHERE r.order_id=o.id AND r.status NOT IN ('completed','rejected')) AS pending_refunds FROM orders o WHERE o.id=ANY($1::uuid[]) AND o.site=$2 ORDER BY o.id FOR UPDATE OF o`, [orderIds, site]);
        if (r.rows.length !== orderIds.length)
            throw new DispatchError('현재 사이트의 주문을 찾을 수 없습니다.', 404);
        const items = await c.query(`SELECT oi.*,p.product_code,p.supplier_name,to_char(p.expected_ship_date,'YYYY-MM-DD') AS expected_ship_date FROM order_items oi LEFT JOIN products_shop p ON p.id=oi.product_id WHERE oi.order_id=ANY($1::uuid[]) ORDER BY oi.order_id,(oi.product_id IS NULL),oi.id`, [orderIds]);
        const snapshot = r.rows.map(o => {
            const lines = items.rows.filter(i => i.order_id === o.id);
            const issues = dispatchIssues({ ...o, items: lines });
            if (!['shop', 'campaign'].includes(o.order_type))
                issues.push('일반 상품 발주 대상이 아님');
            if (issues.length)
                throw new DispatchError(`${o.order_number}: ${issues.join(' · ')}`);
            // Explicit export fields: never retain payment credentials or admin tokens.
            return exportOrder(o,lines);
        });
        const batch = await c.query('INSERT INTO admin_dispatch_batches(site,request_key,order_ids,snapshot) VALUES($1,$2,$3,$4) RETURNING *', [site, key, orderIds, JSON.stringify(snapshot)]);
        await c.query("UPDATE orders SET status='preparing',updated_at=NOW() WHERE id=ANY($1::uuid[]) AND site=$2", [orderIds, site]);
        await c.query('COMMIT');
        return batch.rows[0];
    }
    catch (e) {
        await rollbackSafely(c);
        throw e;
    }
    finally {
        c.release();
    }
}
