import shopPool from "@/lib/db-shop";
import { nextISO, nightsBetween, refundRateFor } from "@/lib/hotel";
import { sendCancellationSMS } from "@/lib/hotel-notify";

export type CancelResult =
  | { ok: true; alreadyCancelled: true }
  | { ok: true; refunded: boolean; refundAmount: number; refundNote: string; smsSent: boolean }
  | { ok: false; error: string; httpStatus: number };

/**
 * 호텔 예약 취소 엔진 — 관리자 취소와 고객 셀프 취소가 공유.
 * 환불 규정(refundRateFor)을 서버에서 계산해 토스 부분 환불 → 상태 변경 + 재고 복원 → 취소 문자.
 */
export async function cancelHotelReservation(
  orderId: string,
  opts: { fullRefund?: boolean; reasonPrefix: string }
): Promise<CancelResult> {
  const { rows } = await shopPool.query(
    `SELECT o.status, o.payment_key,
            o.order_number, o.buyer_name, o.buyer_phone, o.total_amount,
            to_char(o.stay_check_in, 'YYYY-MM-DD') AS ci,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS co,
            (SELECT option_label FROM order_items WHERE order_id = o.id LIMIT 1) AS opt
       FROM orders o WHERE o.id = $1 AND o.order_type = 'hotel'`,
    [orderId]
  );
  const ord = rows[0];
  if (!ord) return { ok: false, error: "예약을 찾을 수 없습니다.", httpStatus: 404 };
  if (ord.status === "cancelled") return { ok: true, alreadyCancelled: true };

  // 환불 규정 적용 (서버가 최종 계산): 6일 전 100% / 5~3일 50% / 2~1일 30% / 당일·경과 0%
  const total = Number(ord.total_amount);
  const policy = refundRateFor(ord.ci);
  const refundAmount = opts.fullRefund ? total : Math.round((total * policy.rate) / 100);
  const refundNote = opts.fullRefund ? "전액 환불" : policy.label;

  // 1) 토스 결제 취소 (실결제 건 + 환불액이 있을 때만)
  if (ord.payment_key && !ord.payment_key.startsWith("SIM_") && refundAmount > 0) {
    const secretKey = process.env.TOSS_SECRET_KEY;
    const body: Record<string, unknown> = { cancelReason: `${opts.reasonPrefix} (${refundNote})` };
    if (refundAmount < total) body.cancelAmount = refundAmount; // 부분 환불
    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${ord.payment_key}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!tossRes.ok) {
      const e = await tossRes.json().catch(() => ({}));
      // 이미 취소된 결제는 정상 처리(상태·재고 정리 계속 진행)
      if (e.code !== "ALREADY_CANCELED_PAYMENT") {
        return { ok: false, error: e.message || "결제 환불에 실패했습니다.", httpStatus: 400 };
      }
    }
  }

  // 2) 상태 취소 + 재고 복원 (option_label = "객실 · 기간" → 앞이 객실타입)
  const room = String(ord.opt || "").split(" · ")[0];
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`, [orderId]);
    if (room && ord.ci && ord.co) {
      let cur = ord.ci;
      while (cur < ord.co) {
        await client.query(
          `UPDATE hotel_room_inventory SET booked = GREATEST(booked - 1, 0) WHERE stay_date = $1 AND room_type = $2`,
          [cur, room]
        );
        cur = nextISO(cur);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[hotel-cancel] 재고 복원 실패:", e);
    // 결제는 이미 환불됨 → 상태는 취소로 처리(재고는 수동 조정)
    await shopPool.query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`, [orderId]);
  } finally {
    client.release();
  }

  // 3) 예약취소 문자 발송 (실패해도 취소·환불엔 영향 없음)
  let smsSent = false;
  if (ord.buyer_phone && ord.ci && ord.co) {
    try {
      const r = await sendCancellationSMS(ord.buyer_phone, {
        buyerName: ord.buyer_name,
        orderNumber: ord.order_number,
        room: room || "예약 객실",
        checkIn: ord.ci,
        checkOut: ord.co,
        nights: nightsBetween(ord.ci, ord.co),
        total,
        refundAmount,
        refundNote,
      });
      smsSent = r.ok;
      if (!r.ok) console.error("[hotel-cancel] 취소 문자 발송 실패:", r.error);
    } catch (e) {
      console.error("[hotel-cancel] 취소 문자 예외:", e);
    }
  }

  return { ok: true, refunded: refundAmount > 0, refundAmount, refundNote, smsSent };
}
