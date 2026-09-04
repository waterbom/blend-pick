import { NextRequest, NextResponse } from "next/server";
import { siteFromRequest } from "@/lib/site-request";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { randomBytes } from "crypto";

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `BP-${date}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();

  const secretKey = process.env.TOSS_SECRET_KEY!;

  // 1. 토스 결제 승인
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const tossData = await tossRes.json();

  if (!tossRes.ok) {
    return NextResponse.json(
      { ok: false, error: tossData.message || "결제 승인 실패" },
      { status: 400 }
    );
  }

  // 2. 인플루언서/공구 스냅샷 — 클라이언트가 넘긴 campaignId를 OS DB에서 재검증
  //    (요율/공급가/이름은 결제시점 DB 값만 신뢰, 클라이언트 값 신뢰 X)
  //    조회 실패해도 주문 저장은 진행 (결제는 이미 승인됨)
  let campaign: {
    id: string;
    influencer_id: string;
    influencer_name: string;
    commission_rate: number | null;
    supply_price: number | null;
  } | null = null;
  if (checkoutData.campaignId) {
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.influencer_id, i.name AS influencer_name,
                c.commission_rate, c.supply_price
         FROM campaigns c
         JOIN influencers i ON i.id = c.influencer_id
         WHERE c.id = $1 AND c.product_id = $2 AND c.is_archived = false`,
        [checkoutData.campaignId, checkoutData.productId]
      );
      campaign = rows[0] || null;
    } catch (e) {
      console.error("[payment/confirm] 캠페인 조회 실패:", e);
    }
  }

  // 3. 샵 orders에 공동구매 주문 저장 (order_type='campaign')
  //    캠페인 상품은 다른 DB라 product_id=NULL + product_name(텍스트)로 저장.
  //    저장 실패해도 토스 승인은 됐으므로 결제완료로 처리(로그만 남김).
  const orderNumber = generateOrderNumber();
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, user_id, buyer_name, buyer_phone, buyer_email,
        recipient_name, recipient_phone,
        addr_zipcode, addr_address, addr_detail, addr_memo,
        total_amount, shipping_fee,
        status, payment_key, payment_method, paid_at, order_type,
        influencer_id, campaign_id, influencer_name, commission_rate, site
      ) VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'paid',$13,$14,NOW(),'campaign',
        $15,$16,$17,$18,$19)
      RETURNING id`,
      [
        orderNumber,
        checkoutData.customerName,
        checkoutData.customerPhone,
        checkoutData.customerEmail || null,
        checkoutData.shippingName || checkoutData.customerName,
        checkoutData.shippingPhone || checkoutData.customerPhone,
        checkoutData.shippingZipcode,
        checkoutData.shippingAddress,
        checkoutData.shippingAddress2 || null,
        checkoutData.shippingMemo || null,
        checkoutData.totalAmount,
        checkoutData.shippingCost ?? 0,
        paymentKey,
        tossData.method,
        campaign?.influencer_id ?? null,
        campaign?.id ?? null,
        campaign?.influencer_name ?? null,
        campaign?.commission_rate ?? null,
        siteFromRequest(req), // 블랜드픽/산지픽 — 어드민 분리 기준
      ]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, unit_price, quantity, supply_price)
       VALUES ($1, NULL, $2, NULL, $3, $4, $5)`,
      [
        rows[0].id,
        checkoutData.productName,
        checkoutData.unitPrice,
        checkoutData.quantity ?? 1,
        campaign?.supply_price ?? null,
      ]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[payment/confirm] 공동구매 주문 저장 실패:", e);
  } finally {
    client.release();
  }

  return NextResponse.json({
    ok: true,
    orderNumber,
    productName: checkoutData.productName,
    totalAmount: checkoutData.totalAmount,
    paymentMethod: tossData.method,
  });
}
