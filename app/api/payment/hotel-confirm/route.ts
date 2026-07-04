import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import shopPool from "@/lib/db-shop";
import { randomBytes } from "crypto";
import { verifyToken } from "@/lib/auth";
import { quoteReservation, mdLabel } from "@/lib/hotel";
import { decrementStay, isStayAvailable } from "@/lib/hotel-inventory";
import { phoneVerifyOn } from "@/lib/sms";
import { isPhoneVerified } from "@/lib/phone-verify";

function genOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BP-H-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();
  const secretKey = process.env.TOSS_SECRET_KEY!;
  const cd = checkoutData;

  // 0. 승인 '전' 검증 — 예약 유효성 + 금액 변조 + 재고 (통과 못하면 결제 승인 안 함)
  const q = quoteReservation(cd.pkg, cd.room, cd.checkIn, cd.checkOut);
  if (!q) {
    return NextResponse.json({ ok: false, error: "예약 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (Number(amount) !== q.total) {
    return NextResponse.json({ ok: false, error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
  }
  if (!(await isStayAvailable(cd.room, q.checkIn, q.nights))) {
    return NextResponse.json({ ok: false, error: "선택하신 날짜가 마감되었습니다." }, { status: 409 });
  }
  // 휴대폰 인증 강제 (인증 스위치가 켜진 경우에만 — 꺼져있으면 기존대로 통과)
  if (phoneVerifyOn()) {
    const verifiedToken = (await cookies()).get("phone_verified")?.value;
    if (!(await isPhoneVerified(verifiedToken, cd.customerPhone))) {
      return NextResponse.json({ ok: false, error: "휴대폰 인증이 필요합니다." }, { status: 403 });
    }
  }

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
    return NextResponse.json({ ok: false, error: tossData.message || "결제 승인 실패" }, { status: 400 });
  }

  // 2. 주문 저장 (order_type='hotel') + 재고 차감
  const nights = q.nights;
  const total = q.total;
  const stay = `${mdLabel(cd.checkIn)}~${mdLabel(cd.checkOut)} (${nights}박)`;
  const productName = `${cd.hotelName} · ${cd.packageLabel} · ${cd.room}`;
  const orderNumber = genOrderNumber();

  // 로그인 유저 연결 (마이페이지 예약 조회용)
  const token = (await cookies()).get("shop_token")?.value;
  const userId = token ? (await verifyToken(token))?.id ?? null : null;

  const client = await shopPool.connect();
  let saved = false;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, user_id, buyer_name, buyer_phone, buyer_email,
        recipient_name, recipient_phone,
        addr_zipcode, addr_address, addr_detail, addr_memo,
        total_amount, shipping_fee,
        status, payment_key, payment_method, paid_at, order_type,
        stay_check_in, stay_check_out
      ) VALUES ($1,$12,$2,$3,NULL,$4,$5,NULL,NULL,NULL,$6,$7,0,'paid',$8,$9,NOW(),'hotel',$10,$11)
      RETURNING id`,
      [
        orderNumber,
        cd.customerName,
        cd.customerPhone,
        cd.customerName,
        cd.customerPhone,
        `투숙 ${stay}${cd.customerMemo ? ` · 요청: ${cd.customerMemo}` : ""}`,
        total,
        paymentKey,
        tossData.method,
        cd.checkIn,
        cd.checkOut,
        userId,
      ]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, option_label, unit_price, quantity)
       VALUES ($1, NULL, $2, $3, $4, 1)`,
      [rows[0].id, productName, `${cd.room} · ${stay}`, total]
    );
    // 각 밤 객실 재고 차감 (승인~여기 사이 경쟁으로 마감되면 롤백)
    const ok = await decrementStay(client, cd.room, cd.checkIn, nights);
    if (!ok) throw new Error("재고 마감(경쟁)");
    await client.query("COMMIT");
    saved = true;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hotel-confirm] 주문 저장 실패:", e);
  } finally {
    client.release();
  }

  if (!saved) {
    return NextResponse.json(
      { ok: false, error: "결제는 승인됐으나 예약 저장에 실패했어요. 고객센터로 문의해주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    orderNumber,
    productName,
    stay,
    nights,
    total,
    paymentMethod: tossData.method,
  });
}
