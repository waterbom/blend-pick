import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();

  const secretKey = process.env.TOSS_SECRET_KEY!;
  const osUrl = process.env.OS_API_URL || "http://localhost:8000";

  // 1. Toss 결제 승인
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

  // 2. OS에 주문 저장
  const orderRes = await fetch(`${osUrl}/orders/api/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: checkoutData.productId,
      customer_name: checkoutData.customerName,
      customer_phone: checkoutData.customerPhone,
      customer_email: checkoutData.customerEmail,
      shipping_name: checkoutData.shippingName,
      shipping_phone: checkoutData.shippingPhone,
      shipping_address: checkoutData.shippingAddress,
      shipping_address2: checkoutData.shippingAddress2,
      shipping_zipcode: checkoutData.shippingZipcode,
      shipping_memo: checkoutData.shippingMemo,
      quantity: 1,
      unit_price: checkoutData.unitPrice,
      total_price: checkoutData.totalAmount,
      payment_key: paymentKey,
      payment_method: tossData.method,
    }),
  });

  const orderData = await orderRes.json();

  if (!orderRes.ok || !orderData.ok) {
    // 토스 승인은 됐지만 DB 저장 실패 — 로그 남기고 성공으로 처리
    console.error("[payment/confirm] OS order save failed:", orderData);
  }

  return NextResponse.json({
    ok: true,
    orderNumber: orderData.order_number,
    productName: checkoutData.productName,
    totalAmount: checkoutData.totalAmount,
    paymentMethod: tossData.method,
  });
}
