import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelHotelReservation } from "@/lib/hotel-cancel";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") || "";
  const where = status
    ? `WHERE o.order_type = 'hotel' AND o.status = $1`
    : `WHERE o.order_type = 'hotel'`;
  const params = status ? [status] : [];

  const result = await shopPool.query(
    `SELECT
       o.id, o.order_number, o.status,
       o.buyer_name, o.buyer_phone,
       o.addr_memo,
       to_char(o.stay_check_in, 'YYYY-MM-DD') AS stay_check_in,
       to_char(o.stay_check_out, 'YYYY-MM-DD') AS stay_check_out,
       o.total_amount, o.created_at, o.influencer_name,
       to_char(o.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS paid_at_kst,
       (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name,
       -- 예약 변경 차액 등 이 예약번호로 결제된 추가 결제 합계 (extra 주문의 품명이 "예약번호 …" 형식)
       COALESCE((
         SELECT SUM(e.total_amount)::bigint
           FROM orders e
           JOIN order_items ei ON ei.order_id = e.id
          WHERE e.order_type = 'extra' AND e.status = 'paid'
            AND ei.product_name LIKE o.order_number || ' %'
       ), 0) AS extra_paid
     FROM orders o
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 500`,
    params
  );

  return NextResponse.json(result.rows);
}

// 예약 상태 변경 (취소 시 토스 환불 + 재고 복원)
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, fullRefund } = await req.json();
  const allowed = ["paid", "checked_in", "cancelled", "no_show"];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 취소가 아니면 상태만 변경
  if (status !== "cancelled") {
    // 이미 취소·환불된 예약은 되돌릴 수 없음 (결제 환불·재고 복원이 끝난 최종 상태)
    const cur = await shopPool.query(
      `SELECT status FROM orders WHERE id = $1 AND order_type = 'hotel'`,
      [id]
    );
    if (!cur.rows[0]) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
    if (cur.rows[0].status === "cancelled") {
      return NextResponse.json(
        { error: "이미 취소·환불된 예약은 상태를 변경할 수 없습니다." },
        { status: 409 }
      );
    }
    const r = await shopPool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND order_type = 'hotel'`,
      [status, id]
    );
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }

  // 취소 → 공용 취소 엔진 (환불 규정 + 토스 부분 환불 + 재고 복원 + 취소 문자)
  const result = await cancelHotelReservation(id, {
    fullRefund: !!fullRefund,
    reasonPrefix: "관리자 예약 취소",
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
  return NextResponse.json(result);
}
