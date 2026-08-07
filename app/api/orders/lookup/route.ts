import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import shopPool from "@/lib/db-shop";
import { isPhoneVerified, normPhone } from "@/lib/phone-verify";

// 비회원 주문 조회 — 휴대폰 인증(phone_verified 쿠키)된 번호의 주문·예약 전체
export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  const p = normPhone(phone);
  if (p.length < 10) {
    return NextResponse.json({ ok: false, error: "올바른 휴대폰 번호를 입력해주세요." }, { status: 400 });
  }

  // 서버측 검증 — 인증 쿠키가 이 번호로 발급된 것인지 확인 (없으면 조회 불가)
  const vt = (await cookies()).get("phone_verified")?.value;
  if (!(await isPhoneVerified(vt, p))) {
    return NextResponse.json({ ok: false, error: "휴대폰 인증이 필요합니다." }, { status: 403 });
  }

  const r = await shopPool.query(
    `SELECT o.id, o.order_number, o.order_type, o.status, o.total_amount,
            o.tracking_company, o.tracking_number,
            COALESCE(o.recipient_name, o.buyer_name) AS recipient_name,
            o.addr_address, o.addr_detail,
            to_char(o.shipped_at   AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS shipped_kst,
            to_char(o.delivered_at AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS delivered_kst,
            to_char(o.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS paid_date,
            to_char(o.stay_check_in, 'YYYY-MM-DD') AS check_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
            (SELECT json_agg(json_build_object('name', oi.product_name, 'option', oi.option_label, 'qty', oi.quantity) ORDER BY (oi.product_id IS NULL), oi.id)
               FROM order_items oi WHERE oi.order_id = o.id) AS items
       FROM orders o
      WHERE regexp_replace(COALESCE(o.buyer_phone, ''), '[^0-9]', '', 'g') = $1
        AND o.order_type IN ('shop', 'hotel')
      ORDER BY o.paid_at DESC NULLS LAST
      LIMIT 50`,
    [p]
  );
  return NextResponse.json({ ok: true, orders: r.rows });
}
