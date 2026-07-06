import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";

// 비회원 예약 조회 — 예약번호 + 예약자 연락처가 모두 일치해야 조회됨
export async function POST(req: NextRequest) {
  const { orderNumber, phone } = await req.json();
  const on = String(orderNumber || "").trim().toUpperCase();
  const ph = String(phone || "").replace(/[^0-9]/g, "");
  if (!on || ph.length < 10) {
    return NextResponse.json({ ok: false, error: "예약번호와 연락처를 정확히 입력해주세요." }, { status: 400 });
  }

  const { rows } = await shopPool.query(
    `SELECT o.order_number, o.status, o.buyer_name, o.buyer_phone, o.total_amount,
            to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
            o.created_at,
            (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
       FROM orders o
      WHERE o.order_type = 'hotel'
        AND UPPER(o.order_number) = $1
        AND regexp_replace(o.buyer_phone, '[^0-9]', '', 'g') = $2
      LIMIT 1`,
    [on, ph]
  );

  if (!rows[0]) {
    return NextResponse.json(
      { ok: false, error: "예약을 찾을 수 없어요. 예약번호와 연락처를 다시 확인해주세요." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, reservation: rows[0] });
}
