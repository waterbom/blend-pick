import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";

// 비회원 예약 조회 — 예약번호 + 예약자 성함이 모두 일치해야 조회됨
export async function POST(req: NextRequest) {
  const { orderNumber, name } = await req.json();
  const on = String(orderNumber || "").trim().toUpperCase();
  const nm = String(name || "").trim();
  if (!on || !nm) {
    return NextResponse.json({ ok: false, error: "예약번호와 예약자 성함을 입력해주세요." }, { status: 400 });
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
        AND LOWER(TRIM(o.buyer_name)) = LOWER(TRIM($2))
      LIMIT 1`,
    [on, nm]
  );

  if (!rows[0]) {
    return NextResponse.json(
      { ok: false, error: "예약을 찾을 수 없어요. 예약번호와 예약자 성함을 다시 확인해주세요." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, reservation: rows[0] });
}
