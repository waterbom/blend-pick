import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import shopPool from "@/lib/db-shop";
import { randomBytes } from "crypto";
import { verifyPayLink } from "@/lib/pay-link";
import { isPhoneVerified } from "@/lib/phone-verify";

function genOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BP-E-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, token, name, phone } = await req.json();
  const secretKey = process.env.TOSS_SECRET_KEY!;

  // 1. 링크 토큰 검증 + 금액 변조 확인 (승인 전)
  const info = token ? await verifyPayLink(token) : null;
  if (!info) return NextResponse.json({ ok: false, error: "유효하지 않은 결제 링크입니다." }, { status: 400 });
  if (Number(amount) !== info.amount) {
    return NextResponse.json({ ok: false, error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
  }

  // 2. 휴대폰 인증 확인 — 결제자 본인 번호로 SMS 인증을 마친 상태여야 승인 진행
  const verifiedTok = (await cookies()).get("phone_verified")?.value;
  if (!(await isPhoneVerified(verifiedTok, phone || ""))) {
    return NextResponse.json({ ok: false, error: "휴대폰 인증이 필요합니다. 인증 후 다시 시도해주세요." }, { status: 401 });
  }

  // 3. 토스 승인
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
    return NextResponse.json({ ok: false, error: tossData.message || "결제 승인 실패" }, { status: 400 });
  }

  // 4. 주문 저장 (order_type='extra')
  const orderNumber = genOrderNumber();
  const memoText = info.label;
  const client = await shopPool.connect();
  let saved = false;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, buyer_name, buyer_phone, recipient_name, recipient_phone,
        addr_memo, total_amount, shipping_fee, status, payment_key, payment_method, paid_at, order_type
      ) VALUES ($1,$2,$3,$2,$3,$4,$5,0,'paid',$6,$7,NOW(),'extra')
      RETURNING id`,
      [orderNumber, name || "-", phone || "-", memoText, info.amount, paymentKey, tossData.method]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, unit_price, quantity)
       VALUES ($1, NULL, $2, $3, $4, 1)`,
      [rows[0].id, info.label, "", info.amount]
    );
    await client.query("COMMIT");
    saved = true;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[extra-confirm] 저장 실패:", e);
  } finally {
    client.release();
  }

  if (!saved) {
    return NextResponse.json({ ok: false, error: "결제는 승인됐으나 저장에 실패했어요. 고객센터로 문의해주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderNumber, amount: info.amount, label: info.label });
}
