import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { shopUnitPrice } from "@/lib/shop-price";
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

  // 3. DB 저장: orders 1건 + order_items N줄 + cart 비우기
  const orderNumber = generateOrderNumber();
  const items: Array<{
    id: string; // cart item id (장바구니 비우기용)
    product_id: string;
    name: string;
    price: number;
    extra_price: number | null;
    quantity: number;
    option_id: string | null;
  }> = checkoutData.items;

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // orders 테이블에 주문 1건 INSERT
    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, user_id, buyer_name, buyer_phone, buyer_email,
        addr_zipcode, addr_address, addr_detail, addr_memo,
        total_amount, shipping_fee,
        status, payment_key, payment_method, paid_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'paid',$12,$13,NOW())
      RETURNING id`,
      [
        orderNumber,
        userId,
        checkoutData.customerName,
        checkoutData.customerPhone,
        checkoutData.customerEmail || null,
        checkoutData.shippingZipcode,
        checkoutData.shippingAddress,
        checkoutData.shippingAddress2 || null,
        checkoutData.shippingMemo || null,
        checkoutData.totalAmount + checkoutData.shippingCost,
        checkoutData.shippingCost,
        paymentKey,
        tossData.method,
      ]
    );

    const newOrderId = rows[0].id;

    // order_items: 장바구니 아이템 수만큼 INSERT
    for (const item of items) {
      const unitPrice = shopUnitPrice(item.price, item.extra_price, item.option_id != null);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, option_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newOrderId, item.product_id, item.option_id ?? null, item.name, unitPrice, item.quantity]
      );
    }

    // 결제 완료된 아이템들을 cart 테이블에서 삭제
    const cartIds = items.map((i) => i.id);
    if (cartIds.length > 0) {
      await client.query(
        `DELETE FROM cart WHERE id = ANY($1::uuid[])`,
        [cartIds]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      orderNumber,
      itemCount: items.length,
      totalAmount: checkoutData.totalAmount + checkoutData.shippingCost,
      paymentMethod: tossData.method,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[cart-confirm] DB 저장 실패:", e);
    return NextResponse.json({ ok: false, error: "주문 저장 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}
