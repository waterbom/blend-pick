import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import shopPool from '@/lib/db-shop';
import { verifyToken } from '@/lib/auth';
import { phoneVerifyOn } from '@/lib/sms';
import { isPhoneVerified } from '@/lib/phone-verify';
import { siteFromRequest } from '@/lib/site-request';
import { SITES, type SiteKey } from '@/lib/sites';
import { processPaymentAttempt, purchaseResult, PurchaseError, type PurchaseSnapshot } from '@/lib/payment-attempt';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 2147483647;
export function campaignBelongsToSite(category: string | null, site: SiteKey) {
  return SITES.sanjipick.categories.includes(category || '') === (site === 'sanjipick');
}

// OS products are snapshotted separately: never reserve or restore products_shop stock.
export async function campaignCheckout(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PurchaseError('결제 요청을 확인해주세요.', 400);
    const { paymentKey, orderId, amount, checkoutData: d } = body;
    if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200 ||
        typeof orderId !== 'string' || !orderId || orderId.length > 200 ||
        !money(amount) || amount === 0 || !d || typeof d !== 'object' || Array.isArray(d)) throw new PurchaseError('결제 요청을 확인해주세요.', 400);
    const site = siteFromRequest(req);
    const hash = createHash('sha256').update(JSON.stringify({ kind: 'campaign', amount, checkoutData: d })).digest('hex');
    const prior = await shopPool.query('SELECT * FROM payment_attempts WHERE payment_key=$1', [paymentKey]);
    if (prior.rows.length) {
      const a = prior.rows[0];
      if (a.site !== site || a.provider_order_id !== orderId || a.request_hash !== hash) throw new PurchaseError('기존 결제 요청과 일치하지 않습니다.');
      return NextResponse.json(a.status === 'completed' ? await purchaseResult(a) : await processPaymentAttempt(paymentKey, site, a.status !== 'prepared'));
    }
    const legacy = await shopPool.query('SELECT id FROM orders WHERE payment_key=$1', [paymentKey]);
    if (legacy.rows.length) throw new PurchaseError('이미 처리된 결제입니다. 주문 내역에서 확인해주세요.');
    if (typeof d.productId !== 'string' || !uuid.test(d.productId) || !Number.isSafeInteger(d.quantity) || d.quantity < 1 || d.quantity > 2147483647 ||
        !money(d.unitPrice) || !money(d.shippingCost) || !money(d.totalAmount)) throw new PurchaseError('상품과 수량을 다시 확인해주세요.', 400);
    const found = await pool.query(`SELECT id,name,category,consumer_price,groupbuy_price,set_options,shipping_type,shipping_cost
      FROM products WHERE id=$1 AND status='active' AND visibility_status='active'`, [d.productId]);
    const p = found.rows[0];
    if (!p || !campaignBelongsToSite(p.category, site)) throw new PurchaseError('현재 사이트에서 판매 중인 상품을 찾을 수 없습니다.', 400);
    const base = Number(p.groupbuy_price) > 0 && Number(p.groupbuy_price) < Number(p.consumer_price) ? Number(p.groupbuy_price) : Number(p.consumer_price);
    let unit = base, optionLabel: string | null = null;
    if (d.optionIndex != null) {
      if (!Number.isSafeInteger(d.optionIndex) || d.optionIndex < 0 || !Array.isArray(p.set_options) || !p.set_options[d.optionIndex]) throw new PurchaseError('상품 옵션을 다시 선택해주세요.', 400);
      const option = p.set_options[d.optionIndex];
      if (option.price == null) throw new PurchaseError('상품 옵션 가격을 확인해주세요.', 400);
      unit = Number(option.price);
      if (typeof option.name !== 'string' || !option.name) throw new PurchaseError('상품 옵션을 확인해주세요.', 400);
      optionLabel = option.name;
    }
    const shipping = p.shipping_type === 'free' ? 0 : Number(p.shipping_cost ?? 0);
    const total = unit * d.quantity + shipping;
    if (!money(unit) || !money(shipping) || !money(total) || total === 0 ||
        d.unitPrice !== unit || d.shippingCost !== shipping || d.totalAmount !== total || amount !== total) throw new PurchaseError('결제 금액이 현재 상품 가격과 달라요. 상품을 다시 확인해주세요.', 400);
    let campaign = null;
    if (d.campaignId != null) {
      if (typeof d.campaignId !== 'string' || !uuid.test(d.campaignId)) throw new PurchaseError('공구 정보를 확인해주세요.', 400);
      const c = await pool.query(`SELECT c.id,c.influencer_id,i.name AS influencer_name,c.commission_rate,c.supply_price
        FROM campaigns c JOIN influencers i ON i.id=c.influencer_id
        WHERE c.id=$1 AND c.product_id=$2 AND c.is_archived=false
        AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
        AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date`, [d.campaignId, p.id]);
      campaign = c.rows[0];
      if (!campaign) throw new PurchaseError('종료되었거나 유효하지 않은 공구입니다.', 400);
    }
    const cookieStore = await cookies(), token = cookieStore.get('shop_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (phoneVerifyOn() && !user?.id && !await isPhoneVerified(cookieStore.get('phone_verified')?.value, d.customerPhone || '')) throw new PurchaseError('비회원 주문은 휴대폰 인증이 필요합니다.', 403);
    const snapshot: PurchaseSnapshot = {
      orderType: 'campaign', campaignId: campaign?.id ?? null,
      orderNumber: `${site === 'sanjipick' ? 'SJ' : 'BP'}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${randomBytes(6).toString('hex').toUpperCase()}`,
      userId: user?.id ?? null, buyerName: d.customerName, buyerPhone: d.customerPhone, buyerEmail: d.customerEmail || null,
      recipientName: d.shippingName || d.customerName, recipientPhone: d.shippingPhone || d.customerPhone,
      zipcode: d.shippingZipcode, address: d.shippingAddress, detail: d.shippingAddress2 || '', memo: d.shippingMemo || '', shipping,
      influencerId: campaign?.influencer_id ?? null, influencerName: campaign?.influencer_name ?? null,
      items: [{ productId: null, productRef: p.id, optionId: null, name: p.name, optionLabel, unitPrice: unit, quantity: d.quantity,
        supplyPrice: campaign?.supply_price ?? null, commissionRate: campaign?.commission_rate ?? null, taxType: null }],
      linkCode: null, linkStartAt: null, linkEndAt: null, cartIds: [],
    };
    const client = await shopPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [paymentKey]);
      const existing = await client.query('SELECT payment_key FROM payment_attempts WHERE payment_key=$1 OR provider_order_id=$2', [paymentKey, orderId]);
      if (existing.rows.length) throw new PurchaseError('같은 결제가 처리 중입니다. 잠시 후 다시 확인해주세요.');
      await client.query(`INSERT INTO payment_attempts(payment_key,provider_order_id,site,request_hash,amount,snapshot)
        VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [paymentKey, orderId, site, hash, total, JSON.stringify(snapshot)]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    return NextResponse.json(await processPaymentAttempt(paymentKey, site));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof PurchaseError ? e.message : '결제 요청을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: e instanceof PurchaseError ? e.status : 503 });
  }
}
