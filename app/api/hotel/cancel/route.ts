import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import shopPool from "@/lib/db-shop";
import { refundRateFor } from "@/lib/hotel";
import { cancelHotelReservation } from "@/lib/hotel-cancel";
import { isPhoneVerified, normPhone } from "@/lib/phone-verify";

/**
 * 고객 셀프 예약 취소.
 * 3중 확인: ① 예약번호+전화번호 일치 ② 해당 번호로 문자 인증 완료(phone_verified 쿠키)
 *          ③ 환불 규정은 서버 계산 (당일/경과 0%는 셀프 취소 불가 → 카카오 문의 유도)
 */
export async function POST(req: NextRequest) {
  const { order_number, phone } = await req.json();
  if (!order_number || !phone) {
    return NextResponse.json({ error: "예약번호와 연락처가 필요합니다." }, { status: 400 });
  }

  const { rows } = await shopPool.query(
    `SELECT id, status, buyer_phone, total_amount,
            to_char(stay_check_in, 'YYYY-MM-DD') AS ci
       FROM orders
      WHERE order_number = $1 AND order_type = 'hotel'`,
    [order_number]
  );
  const ord = rows[0];
  if (!ord || normPhone(ord.buyer_phone) !== normPhone(phone)) {
    return NextResponse.json({ error: "예약 정보가 일치하지 않습니다." }, { status: 404 });
  }

  // 본인 휴대폰 문자 인증 필수 (예약자 번호 기준)
  const verifiedToken = (await cookies()).get("phone_verified")?.value;
  if (!(await isPhoneVerified(verifiedToken, ord.buyer_phone))) {
    return NextResponse.json({ error: "휴대폰 인증이 필요합니다." }, { status: 401 });
  }

  if (ord.status === "cancelled") {
    return NextResponse.json({ error: "이미 취소된 예약입니다." }, { status: 409 });
  }
  if (ord.status !== "paid") {
    return NextResponse.json({ error: "온라인 취소가 불가한 예약 상태입니다. 카카오톡 채널로 문의해주세요." }, { status: 409 });
  }

  // 당일/경과(환불 0%)는 분쟁 방지를 위해 셀프 취소 차단 — 카카오 문의로
  const policy = refundRateFor(ord.ci);
  if (policy.rate === 0) {
    return NextResponse.json(
      { error: "체크인 당일/경과 예약은 온라인 취소가 불가합니다. 카카오톡 채널로 문의해주세요." },
      { status: 409 }
    );
  }

  const result = await cancelHotelReservation(ord.id, {
    fullRefund: false,
    reasonPrefix: "고객 셀프 취소",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  return NextResponse.json(result);
}
