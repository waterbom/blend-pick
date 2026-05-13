import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { randomBytes } from "crypto";

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `BP-${date}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();

  const secretKey = process.env.TOSS_SECRET_KEY!;

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

  // 3. blendpunch_shop DB에 orders + order_items 저장
  const orderNumber = generateOrderNumber();
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, buyer_name, buyer_phone, buyer_email,
        addr_zipcode, addr_address, addr_detail,
        total_amount, shipping_fee,
        status, payment_key, payment_method, paid_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10,$11,NOW())
      RETURNING id`,
      [
        orderNumber,
        checkoutData.customerName,
        checkoutData.customerPhone,
        checkoutData.customerEmail || null,
        checkoutData.shippingZipcode,
        checkoutData.shippingAddress,
        checkoutData.shippingAddress2 || null,
        checkoutData.totalAmount,
        checkoutData.shippingCost,
        paymentKey,
        tossData.method,
      ]
    );

    const newOrderId = rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        newOrderId,
        checkoutData.productId,
        checkoutData.productName,
        checkoutData.unitPrice,
        checkoutData.quantity,
      ]
    );

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
