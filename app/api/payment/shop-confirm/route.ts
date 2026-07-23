import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { findClosedSaleProduct } from "@/lib/sale-window";
import { randomBytes } from "crypto";

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `BP-${date}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();

  const secretKey = process.env.TOSS_SECRET_KEY!;

  // 0. 판매 시간창 검사 — 오픈 전/종료 상품은 승인 자체를 막는다 (승인 전이라 카드 청구 없음)
  const closed = await findClosedSaleProduct([checkoutData?.productId]);
  if (closed) {
    return NextResponse.json(
      { ok: false, error: "아직 판매 기간이 아니거나 종료된 상품입니다. 오픈 시간에 다시 시도해주세요." },
      { status: 400 }
    );
  }

  // 1. 토스페이먼츠 결제 승인
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

  // 2. 로그인 유저 확인 (비로그인도 허용)
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  let userId: string | null = null;
  if (token) {
    const payload = await verifyToken(token);
    userId = payload?.id ?? null;
  }

  // 3. 인플루언서 링크 유입 검증 — 이름은 DB값만 신뢰, 요율은 상품의 influencer_rate 스냅샷
  let influencer: { id: string; name: string } | null = null;
  let commissionRate: number | null = null;
  if (checkoutData.influencerId) {
    try {
      const r = await pool.query("SELECT id, name FROM influencers WHERE id = $1", [checkoutData.influencerId]);
      influencer = r.rows[0] ?? null;
      if (influencer) {
        const pr = await shopPool.query("SELECT influencer_rate FROM products_shop WHERE id = $1", [checkoutData.productId]);
        commissionRate = pr.rows[0]?.influencer_rate != null ? Number(pr.rows[0].influencer_rate) : null;
      }
    } catch (e) {
      console.error("[shop-confirm] 인플루언서 조회 실패:", e);
    }
  }

  // 4. blendpunch_shop DB에 orders + order_items 저장
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
        influencer_id, influencer_name, commission_rate
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'paid',$14,$15,NOW(),'shop',
        $16,$17,$18)
      RETURNING id`,
      [
        orderNumber,
        userId,
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
        checkoutData.shippingCost,
        paymentKey,
        tossData.method,
        influencer?.id ?? null,
        influencer?.name ?? null,
        influencer ? commissionRate : null,
      ]
    );

    const newOrderId = rows[0].id;

    // 결제시점 공급가 스냅샷 (옵션 공급가 우선, 없으면 상품 공급가)
    const spRes = await client.query(
      `SELECT COALESCE(po.supply_price, ps.supply_price) AS supply_price
       FROM products_shop ps
       LEFT JOIN product_options po ON po.id = $2 AND po.product_id = ps.id
       WHERE ps.id = $1`,
      [checkoutData.productId, checkoutData.optionId ?? null]
    );
    const supplyPrice = spRes.rows[0]?.supply_price ?? null;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, unit_price, quantity, supply_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        newOrderId,
        checkoutData.productId,
        checkoutData.productName,
        checkoutData.optionLabel || null,
        checkoutData.unitPrice,
        checkoutData.quantity,
        supplyPrice,
      ]
    );

    // 재고 차감 — 옵션 상품은 옵션 재고, 상품 재고는 항상 함께 차감 (관리자 목록 표시 기준)
    await client.query(
      `UPDATE products_shop SET stock = GREATEST(stock - $1, 0) WHERE id = $2`,
      [checkoutData.quantity, checkoutData.productId]
    );
    if (checkoutData.optionId) {
      await client.query(
        `UPDATE product_options SET stock = GREATEST(stock - $1, 0) WHERE id = $2`,
        [checkoutData.quantity, checkoutData.optionId]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      orderNumber,
      productName: checkoutData.productName,
      totalAmount: checkoutData.totalAmount,
      paymentMethod: tossData.method,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[shop-confirm] DB 저장 실패:", e);
    return NextResponse.json({ ok: false, error: "주문 저장 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}
