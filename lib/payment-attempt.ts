import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";
import type { VerifiedItem } from "@/lib/order-amount";
import { normalizePaymentMethod } from "@/lib/payment-fees.cjs";
export interface PurchaseSnapshot {
    orderType?: 'shop' | 'campaign';
    campaignId?: string | null;
    orderNumber: string;
    userId: string | null;
    buyerName: string;
    buyerPhone: string;
    buyerEmail: string | null;
    recipientName: string;
    recipientPhone: string;
    zipcode: string;
    address: string;
    detail: string;
    memo: string;
    shipping: number;
    influencerId: string | null;
    influencerName: string | null;
    items: VerifiedItem[];
    linkCode: string | null;
    linkStartAt: string | Date | null;
    linkEndAt: string | Date | null;
    cartIds: string[];
}
export type PaymentAttempt = {
    payment_key: string;
    provider_order_id: string;
    site: SiteKey;
    amount: number;
    request_hash: string;
    snapshot: PurchaseSnapshot;
    status: string;
    lease_until: string | null;
    order_id: string | null;
    created_at: string;
    rejection_code?: string | null;
    provider_method?: string | null;
};
export class PurchaseError extends Error {
    constructor(message: string, public status = 409) { super(message); }
}
const headers = () => ({ Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`, 'Content-Type': 'application/json' });
async function provider(path: string, body?: object, key?: string) {
    const res = await fetch('https://api.tosspayments.com/v1/payments' + path, { method: body ? 'POST' : 'GET', headers: { ...headers(), ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}
function matches(a: PaymentAttempt, p: Record<string, unknown>) { return p.paymentKey === a.payment_key && p.orderId === a.provider_order_id && Number(p.totalAmount) === Number(a.amount); }
export async function purchaseResult(a: PaymentAttempt, method?: string) {
    method = method || a.provider_method || undefined;
    if (!method && a.order_id) {
        const order = await shopPool.query('SELECT payment_method FROM orders WHERE id=$1 AND site=$2', [a.order_id, a.site]);
        const stored = order.rows[0]?.payment_method;
        method = stored === 'transfer' ? '계좌이체' : stored === 'card' ? '카드' : stored;
    }
    return { ok: true, orderNumber: a.snapshot.orderNumber, productName: a.snapshot.items[0]?.name, itemCount: a.snapshot.items.length, totalAmount: Number(a.amount), paymentMethod: method }; }
async function releaseReservation(a: PaymentAttempt) {
    const c = await shopPool.connect();
    try {
        await c.query('BEGIN');
        const lock = await c.query("UPDATE payment_attempts SET status='failed',lease_until=NULL,updated_at=NOW() WHERE payment_key=$1 AND status NOT IN ('failed','completed') RETURNING payment_key", [a.payment_key]);
        if (lock.rows.length)
            for (const i of a.snapshot.items.filter(i => i.productId).sort((a, b) => a.productId!.localeCompare(b.productId!))) {
                await c.query('UPDATE products_shop SET stock=CASE WHEN stock<0 THEN stock ELSE stock+$1 END,updated_at=NOW() WHERE id=$2', [i.quantity, i.productId]);
                if (i.optionId)
                    await c.query('UPDATE product_options SET stock=CASE WHEN stock<0 THEN stock ELSE stock+$1 END WHERE id=$2', [i.quantity, i.optionId]);
            }
        await c.query('COMMIT');
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    }
}
async function finish(a: PaymentAttempt, method: string, approvedAt: string) {
    const c = await shopPool.connect();
    try {
        await c.query('BEGIN');
        const current = await c.query('SELECT status FROM payment_attempts WHERE payment_key=$1 FOR UPDATE', [a.payment_key]);
        if (current.rows[0]?.status === 'completed') {
            await c.query('COMMIT');
            return purchaseResult(a, method);
        }
        if (current.rows[0]?.status === 'failed')
            throw new PurchaseError('실패 처리된 결제입니다. 관리자 확인이 필요합니다.');
        const s = a.snapshot;
        const order = await c.query(`INSERT INTO orders(order_number,user_id,buyer_name,buyer_phone,buyer_email,recipient_name,recipient_phone,
 addr_zipcode,addr_address,addr_detail,addr_memo,total_amount,shipping_fee,status,payment_key,payment_method,paid_at,order_type,
 influencer_id,influencer_name,commission_rate,site,link_code,link_start_at,link_end_at,campaign_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'paid',$14,$15,$23,$24,$16,$17,$18,$19,$20,$21,$22,$25) RETURNING id`, [s.orderNumber, s.userId, s.buyerName, s.buyerPhone, s.buyerEmail, s.recipientName, s.recipientPhone, s.zipcode, s.address, s.detail, s.memo, a.amount, s.shipping, a.payment_key, normalizePaymentMethod(method), s.influencerId, s.influencerName, s.influencerId ? s.items[0]?.commissionRate : null, a.site, s.linkCode, s.linkStartAt, s.linkEndAt, approvedAt, s.orderType ?? 'shop', s.campaignId ?? null]);
        const id = order.rows[0].id;
        for (const i of s.items)
            await c.query(`INSERT INTO order_items(order_id,product_id,option_id,product_ref,product_name,option_label,unit_price,quantity,supply_price,commission_rate,tax_type)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, i.productId, i.optionId, i.productRef, i.name, i.optionLabel, i.unitPrice, i.quantity, i.supplyPrice, s.influencerId ? i.commissionRate : 0, i.taxType]);
        if (s.userId && s.cartIds.length)
            await c.query('DELETE FROM cart WHERE id=ANY($1::uuid[]) AND user_id=$2 AND site=$3', [s.cartIds, s.userId, a.site]);
        await c.query("UPDATE payment_attempts SET status='completed',order_id=$2,provider_method=$3,lease_until=NULL,last_error=NULL,updated_at=NOW() WHERE payment_key=$1", [a.payment_key, id, method]);
        await c.query('COMMIT');
        return purchaseResult(a, method);
    }
    catch (e) {
        await c.query('ROLLBACK');
        throw e;
    }
    finally {
        c.release();
    }
}
// Recovery performs a provider lookup first. Never approve a new payment from an admin retry.
export async function processPaymentAttempt(paymentKey: string, site: SiteKey, recovery = false) {
    const claim = await shopPool.query(`UPDATE payment_attempts SET lease_until=NOW()+INTERVAL '2 minutes',updated_at=NOW()
 WHERE payment_key=$1 AND site=$2 AND status NOT IN ('completed','failed') AND (lease_until IS NULL OR lease_until<NOW()) RETURNING *`, [paymentKey, site]);
    if (!claim.rows.length) {
        const current = await shopPool.query('SELECT * FROM payment_attempts WHERE payment_key=$1 AND site=$2', [paymentKey, site]);
        if (current.rows[0]?.status === 'completed')
            return purchaseResult(current.rows[0]);
        throw new PurchaseError('결제 처리 중이거나 확인이 필요한 요청입니다. 잠시 후 다시 확인해주세요.');
    }
    const a = claim.rows[0] as PaymentAttempt;
    try {
        let p: Record<string, unknown> | null = null;
        if (recovery || a.status !== 'prepared') {
            const lookup = await provider('/' + encodeURIComponent(paymentKey));
            if (a.rejection_code && lookup.status === 404 && lookup.data.code === 'NOT_FOUND_PAYMENT') {
                await releaseReservation(a);
                throw new PurchaseError('결제 거절을 확인하고 재고 예약을 해제했습니다.',400);
            }
            if (!lookup.ok || !matches(a, lookup.data))
                throw new PurchaseError('결제사 응답을 확인하지 못했습니다. 재고 예약을 유지합니다.');
            p = lookup.data;
            if (['CANCELED', 'ABORTED', 'EXPIRED'].includes(String(p!.status))) {
                await releaseReservation(a);
                throw new PurchaseError('결제 실패·취소를 확인하고 재고 예약을 해제했습니다.', 400);
            }
            if (p!.status !== 'DONE')
                throw new PurchaseError('승인 완료 여부를 확인해야 합니다. 재고 예약을 유지합니다.');
        }
        if (!p) {
            if (a.snapshot.linkEndAt && Date.now() >= new Date(a.snapshot.linkEndAt).getTime()) {
                await releaseReservation(a);
                throw new PurchaseError('잘못된 요청입니다', 400);
            }
            // Persist uncertain state before sending anything to PG, including a process crash during fetch.
            await shopPool.query("UPDATE payment_attempts SET status='confirming' WHERE payment_key=$1", [paymentKey]);
            const approved = await provider('/confirm', { paymentKey, orderId: a.provider_order_id, amount: Number(a.amount) }, 'confirm-' + paymentKey);
            if (!approved.ok) {
                const rejected = [400,403,404].includes(approved.status) && ['INVALID_REQUEST','NOT_FOUND_PAYMENT','REJECT_CARD_PAYMENT','REJECT_ACCOUNT_PAYMENT','REJECT_CARD_COMPANY'].includes(String(approved.data.code));
                if (rejected) await shopPool.query('UPDATE payment_attempts SET rejection_code=$2 WHERE payment_key=$1', [paymentKey, approved.data.code]);
                const lookup = await provider('/' + encodeURIComponent(paymentKey));
                if (rejected && lookup.status === 404 && lookup.data.code === 'NOT_FOUND_PAYMENT') {
                    await releaseReservation(a);
                    throw new PurchaseError('결제 거절을 확인하고 재고 예약을 해제했습니다.',400);
                }
                if (lookup.ok && matches(a, lookup.data) && ['CANCELED', 'ABORTED', 'EXPIRED'].includes(lookup.data.status))
                    await releaseReservation(a);
                if (!lookup.ok || !matches(a, lookup.data) || lookup.data.status !== 'DONE')
                    throw new PurchaseError('결제 승인을 확인하지 못했습니다. 관리자 확인 목록에 기록했습니다.');
                p = lookup.data;
            }
            else
                p = approved.data;
            if (!matches(a, p!) || p!.status !== 'DONE')
                throw new PurchaseError('결제 금액 또는 완료 상태를 확인해야 합니다.');
        }
        await shopPool.query("UPDATE payment_attempts SET status='approved' WHERE payment_key=$1", [paymentKey]);
        const approvedAt = typeof p!.approvedAt === 'string' && !Number.isNaN(Date.parse(p!.approvedAt)) ? p!.approvedAt : a.created_at;
        return await finish(a, String(p!.method || 'card'), approvedAt);
    }
    catch (e) {
        await shopPool.query(`UPDATE payment_attempts SET status='needs_review',lease_until=NULL,last_error=$2,updated_at=NOW() WHERE payment_key=$1 AND status NOT IN ('completed','failed')`, [paymentKey, e instanceof PurchaseError ? e.message : '승인 또는 주문 저장 결과 확인 필요']).catch(() => { });
        if (e instanceof PurchaseError)
            throw e;
        throw new PurchaseError('결제 확인 내역을 보관했습니다. 주문 복구가 필요합니다.', 503);
    }
}
