import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { siteFromRequest } from "@/lib/site-request";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { phoneVerifyOn } from "@/lib/sms";
import { isPhoneVerified } from "@/lib/phone-verify";
import { infRefFromCookie } from "@/lib/inf-ref";
import { verifyCartAmount, verifySingleAmount, type CartAmountItem } from "@/lib/order-amount";
import { processPaymentAttempt, purchaseResult, PurchaseError, type PurchaseSnapshot } from "@/lib/payment-attempt";
import { createHash, randomBytes } from "crypto";
export async function shopCheckout(req: NextRequest, kind: 'shop' | 'cart') {
    try {
        const site = siteFromRequest(req), { paymentKey, orderId, amount, checkoutData: d } = await req.json();
        if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200 || typeof orderId !== 'string' || !orderId || !Number.isSafeInteger(amount) || amount <= 0 || !d)
            throw new PurchaseError('결제 요청을 확인해주세요.', 400);
        const hash = createHash('sha256').update(JSON.stringify({ kind, amount, checkoutData: d })).digest('hex');
        const prior = await shopPool.query('SELECT * FROM payment_attempts WHERE payment_key=$1', [paymentKey]);
        if (prior.rows.length) {
            const a = prior.rows[0];
            if (a.site !== site || a.provider_order_id !== orderId || a.request_hash !== hash)
                throw new PurchaseError('기존 결제 요청과 일치하지 않습니다.');
            return NextResponse.json(a.status === 'completed' ? await purchaseResult(a) : await processPaymentAttempt(paymentKey, site, a.status !== 'prepared'));
        }
        // Protect pre-migration payments too: do not create another order for an already stored PG key.
        const legacy = await shopPool.query('SELECT id FROM orders WHERE payment_key=$1', [paymentKey]);
        if (legacy.rows.length)
            throw new PurchaseError('이미 처리된 결제입니다. 주문 내역에서 확인해주세요.');
        const cookieStore = await cookies(), token = cookieStore.get('shop_token')?.value;
        const user = token ? await verifyToken(token) : null, userId = user?.id ?? null;
        if (phoneVerifyOn() && !userId && !await isPhoneVerified(cookieStore.get('phone_verified')?.value, d.customerPhone || ''))
            throw new PurchaseError('비회원 주문은 휴대폰 인증이 필요합니다.', 403);
        const items: CartAmountItem[] = kind === 'cart' ? (Array.isArray(d.items) ? d.items : []) : [{ product_id: d.productId, option_id: d.optionId, quantity: d.quantity, link_code: d.linkCode }];
        if (!items.length || items.length > 100)
            throw new PurchaseError('상품 목록을 확인해주세요.', 400);
        const cartIds: string[] = kind === 'cart' ? d.items.map((i: {
            id?: string;
        }) => i.id).filter((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) : [];
        if (cartIds.length) {
            const cart = await shopPool.query('SELECT user_id,site FROM cart WHERE id=ANY($1::uuid[])', [cartIds]);
            if (cart.rows.length !== new Set(cartIds).size || cart.rows.some(i => !userId || i.user_id !== userId || i.site !== site))
                throw new PurchaseError('현재 사이트의 장바구니에서 다시 결제해주세요.', 400);
        }
        const infId = d.influencerId || await infRefFromCookie();
        let inf: {
            id: string;
            name: string;
        } | null = null;
        if (infId) {
            if (typeof infId !== 'string' || !/^[0-9a-f-]{36}$/i.test(infId))
                throw new PurchaseError('추천인 정보를 확인해주세요.', 400);
            const found = await pool.query('SELECT id,name FROM influencers WHERE id=$1', [infId]);
            inf = found.rows[0] ?? null;
        }
        const c = await shopPool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [paymentKey]);
            const exists = await c.query('SELECT payment_key FROM payment_attempts WHERE payment_key=$1 OR provider_order_id=$2', [paymentKey, orderId]);
            if (exists.rows.length)
                throw new PurchaseError('같은 결제가 처리 중입니다. 잠시 후 다시 확인해주세요.');
            const ids = [...new Set(items.filter(i => i.product_id && !i.is_addon).map(i => i.product_id))].sort();
            await c.query('SELECT id FROM products_shop WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
            const checked = kind === 'shop' ? await verifySingleAmount({ site, productId: d.productId, optionId: d.optionId, quantity: d.quantity, unitPrice: d.unitPrice, shippingCost: d.shippingCost, totalAmount: d.totalAmount, amount, linkCode: d.linkCode }, c) : await verifyCartAmount({ site, items, totalAmount: d.totalAmount, shippingCost: d.shippingCost, amount }, c);
            if (!checked.ok)
                throw new PurchaseError(checked.error, 400);
            for (const i of checked.snapshots.filter(i => i.productId).sort((a, b) => a.productId!.localeCompare(b.productId!))) {
                const changed = await c.query(`UPDATE products_shop SET stock=CASE WHEN stock<0 THEN stock ELSE stock-$1 END,updated_at=NOW() WHERE id=$2 AND (stock<0 OR stock >= $1) RETURNING id`, [i.quantity, i.productId]);
                if (!changed.rows.length)
                    throw new PurchaseError('재고가 변경되었습니다. 다시 확인해주세요.');
                if (i.optionId) {
                    const option = await c.query('UPDATE product_options SET stock=CASE WHEN stock<0 THEN stock ELSE stock-$1 END WHERE id=$2 AND is_active=true AND removed_at IS NULL AND (stock<0 OR stock >= $1) RETURNING id', [i.quantity, i.optionId]);
                    if (!option.rows.length)
                        throw new PurchaseError('옵션 재고가 변경되었습니다.');
                }
            }
            const snapshot: PurchaseSnapshot = { orderNumber: `${site === 'sanjipick' ? 'SJ' : 'BP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(6).toString('hex').toUpperCase()}`, userId, buyerName: d.customerName, buyerPhone: d.customerPhone, buyerEmail: d.customerEmail || null, recipientName: d.shippingName || d.customerName, recipientPhone: d.shippingPhone || d.customerPhone, zipcode: d.shippingZipcode, address: d.shippingAddress, detail: d.shippingAddress2 || '', memo: d.shippingMemo || '', shipping: Number(d.shippingCost), influencerId: inf?.id ?? null, influencerName: inf?.name ?? null, items: checked.snapshots, linkCode: checked.linkCode, linkStartAt: checked.linkStartAt, linkEndAt: checked.linkEndAt, cartIds };
            await c.query(`INSERT INTO payment_attempts(payment_key,provider_order_id,site,request_hash,amount,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [paymentKey, orderId, site, hash, amount, JSON.stringify(snapshot)]);
            await c.query('COMMIT');
        }
        catch (e) {
            await c.query('ROLLBACK');
            throw e;
        }
        finally {
            c.release();
        }
        return NextResponse.json(await processPaymentAttempt(paymentKey, site));
    }
    catch (e) {
        return NextResponse.json({ ok: false, error: e instanceof PurchaseError ? e.message : '결제 요청을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: e instanceof PurchaseError ? e.status : 500 });
    }
}
