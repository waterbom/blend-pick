import { rollbackSafely, withApiErrors, readJsonObject, apiErrorResponse } from '@/lib/api-errors';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';
import shopPool from '@/lib/db-shop';
import { siteFromRequest } from '@/lib/site-request';
import { verifyPayLink } from '@/lib/pay-link';
import { isPhoneVerified } from '@/lib/phone-verify';
import { buyerContactError } from '@/lib/checkout-contact';
import { processPaymentAttempt, purchaseResult, PurchaseError, type PurchaseSnapshot } from '@/lib/payment-attempt';

async function handlePOST(req: NextRequest) {
    try {
        const body = await readJsonObject(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PurchaseError('결제 요청을 확인해주세요.', 400);
        const { paymentKey, orderId, amount, token, name, phone } = body;
        const site = siteFromRequest(req);
        if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200 || typeof orderId !== 'string' || !orderId || orderId.length > 200 || !Number.isSafeInteger(amount) || amount <= 0 || typeof token !== 'string' || !token || token.length > 10000)
            throw new PurchaseError('결제 요청을 확인해주세요.', 400);
        const contactError = buyerContactError(name, phone);
        if (contactError) throw new PurchaseError(contactError, 400);
        if (!await isPhoneVerified((await cookies()).get('phone_verified')?.value, phone)) throw new PurchaseError('휴대폰 인증이 필요합니다. 인증 후 다시 시도해주세요.', 401);
        const hash = createHash('sha256').update(JSON.stringify({ kind: 'extra', amount, token, name, phone })).digest('hex');
        const prior = (await shopPool.query('SELECT * FROM payment_attempts WHERE payment_key=$1', [paymentKey])).rows[0];
        if (prior) {
            if (prior.site !== site || prior.provider_order_id !== orderId || prior.request_hash !== hash || prior.snapshot.orderType !== 'extra') throw new PurchaseError('기존 결제 요청과 일치하지 않습니다.');
            // Persisted attempts remain recoverable after the original link expires.
            return NextResponse.json(prior.status === 'completed' ? await purchaseResult(prior) : await processPaymentAttempt(paymentKey, site, prior.status !== 'prepared'));
        }
        const info = await verifyPayLink(token);
        if (!info || info.site !== site || info.amount !== amount) throw new PurchaseError('유효한 결제 링크와 금액을 확인해주세요.', 400);
        const snapshot: PurchaseSnapshot = {
            orderType: 'extra', orderNumber: `${site === 'sanjipick' ? 'SJ' : 'BP'}-E-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(6).toString('hex').toUpperCase()}`,
            userId: null, buyerName: name, buyerPhone: phone, buyerEmail: null, recipientName: name, recipientPhone: phone,
            zipcode: '', address: '', detail: '', memo: info.label, shipping: 0, influencerId: null, influencerName: null,
            items: [{ productId: null, productRef: null, optionId: null, name: info.label, optionLabel: '', unitPrice: amount, quantity: 1, supplyPrice: null, commissionRate: null, taxType: null }],
            linkCode: null, linkStartAt: null, linkEndAt: null, cartIds: [],
        };
        const client = await shopPool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [paymentKey]);
            const existing = await client.query('SELECT payment_key FROM payment_attempts WHERE payment_key=$1 OR provider_order_id=$2 UNION ALL SELECT payment_key FROM orders WHERE payment_key=$1', [paymentKey, orderId]);
            if (existing.rows.length) throw new PurchaseError('이미 처리되었거나 처리 중인 결제입니다. 주문 내역에서 확인해주세요.');
            await client.query('INSERT INTO payment_attempts(payment_key,provider_order_id,site,request_hash,amount,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [paymentKey, orderId, site, hash, amount, JSON.stringify(snapshot)]);
            await client.query('COMMIT');
        } catch (e) { await rollbackSafely(client); throw e; }
        finally { client.release(); }
        return NextResponse.json(await processPaymentAttempt(paymentKey, site));
    } catch (e) {
        return apiErrorResponse(e, { ok: false, error: e instanceof PurchaseError ? e.message : '결제 요청을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: e instanceof PurchaseError ? e.status : 503 });
    }
}

export const POST = withApiErrors('POST /api/payment/extra-confirm', handlePOST);
