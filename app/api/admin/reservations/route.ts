import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelHotelReservation } from "@/lib/hotel-cancel";
import { smsConfigured } from "@/lib/sms";
import { sendReservationSMS } from "@/lib/hotel-notify";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 입실시간(체크인일 15:00 KST)이 지난 예약확정 건은 자동으로 체크인완료 처리
  // (노쇼였다면 목록의 상태 선택에서 노쇼로 정정 — 매출 집계는 둘 다 포함이라 금액엔 영향 없음)
  await shopPool.query(
    `UPDATE orders SET status = 'checked_in'
      WHERE order_type = 'hotel' AND status = 'paid'
        AND stay_check_in IS NOT NULL
        AND stay_check_in::date + TIME '15:00' <= (NOW() AT TIME ZONE 'Asia/Seoul')`
  );

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
       o.total_amount, o.created_at, o.influencer_name, o.influencer_id,
       o.stay_changed_at IS NOT NULL AS stay_changed,
       -- 취소 후 재결제: 같은 연락처로 이 예약보다 먼저 취소된 호텔 예약이 있는 경우 (취소된 예약 자신은 제외)
       (o.status <> 'cancelled' AND EXISTS (
         SELECT 1 FROM orders c
          WHERE c.order_type = 'hotel' AND c.status = 'cancelled'
            AND c.buyer_phone = o.buyer_phone
            AND c.id <> o.id AND c.created_at < o.created_at
       )) AS repaid_after_cancel,
       to_char(o.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS paid_at_kst,
       to_char(o.cancelled_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS cancelled_at_kst,
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
    const wasAwaiting = cur.rows[0].status === "awaiting";
    const r = await shopPool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND order_type = 'hotel'`,
      [status, id]
    );

    // 예약대기 → 예약확정 승인: 고객에게 예약확정 문자 발송 (결제 시엔 안 보냈음)
    let smsSent = false;
    if (wasAwaiting && status === "paid" && smsConfigured()) {
      try {
        const o = (await shopPool.query(
          `SELECT o.order_number, o.buyer_name, o.buyer_phone, o.total_amount,
                  to_char(o.stay_check_in, 'YYYY-MM-DD') AS check_in,
                  to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
                  (SELECT oi.product_name FROM order_items oi WHERE oi.order_id = o.id LIMIT 1) AS product_name
           FROM orders o WHERE o.id = $1`,
          [id]
        )).rows[0];
        const nights = Math.round(
          (Date.parse(o.check_out) - Date.parse(o.check_in)) / 86400000
        );
        const sms = await sendReservationSMS(o.buyer_phone, {
          buyerName: o.buyer_name,
          orderNumber: o.order_number,
          room: (o.product_name || "").split(" · ")[2] || "",
          checkIn: o.check_in,
          checkOut: o.check_out,
          nights: Math.max(1, nights),
          total: Number(o.total_amount),
        });
        if (sms.ok) {
          smsSent = true;
          await shopPool.query(`UPDATE orders SET kakao_notified_at = NOW() WHERE id = $1`, [id]);
        }
      } catch (e) {
        console.error("[reservations] 승인 확정 문자 발송 실패:", e);
      }
    }
    return NextResponse.json({ ok: true, updated: r.rowCount, smsSent });
  }

  // 취소 → 공용 취소 엔진 (환불 규정 + 토스 부분 환불 + 재고 복원 + 취소 문자)
  const result = await cancelHotelReservation(id, {
    fullRefund: !!fullRefund,
    reasonPrefix: "관리자 예약 취소",
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.httpStatus });
  return NextResponse.json(result);
}
