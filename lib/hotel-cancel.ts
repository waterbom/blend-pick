import { runRefund, RefundError } from '@/lib/refund-operation';
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

  const room = String(ord.opt || "").split(" · ")[0];
  let actualRefund = refundAmount;
  try {
    const result = await runRefund({sourceKey:'hotel:'+orderId,orderId,
      prepare:async(_client,o)=>{
        if(o.order_type!=='hotel'||!['paid','confirmed','cancel_requested'].includes(o.status))throw new RefundError('취소 가능한 예약 상태가 아닙니다.');
        return {amount:refundAmount,reason:`${opts.reasonPrefix} (${refundNote})`};
      },
      apply:async(client,o)=>{
        if(o.status==='cancelled')return;
        await client.query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), updated_at=NOW(), refund_amount_unresolved=false WHERE id = $1`,[orderId]);
        if(room && ord.ci && ord.co) {
          let cur=ord.ci;
          while(cur<ord.co) {
            await client.query('UPDATE hotel_room_inventory SET booked = GREATEST(booked - 1, 0) WHERE stay_date = $1 AND room_type = $2',[cur,room]);
            cur=nextISO(cur);
          }
        }
      }});
    if(result.alreadyCompleted)return {ok:true,alreadyCancelled:true};
    actualRefund=result.amount;
  } catch(e) {
    console.error('[hotel-cancel] 환불 또는 완료 저장 확인 필요',e);
    return {ok:false,error:e instanceof RefundError?e.message:'취소 결과 확인이 필요합니다. 같은 예약에서 다시 확인해주세요.',httpStatus:e instanceof RefundError?e.status:503};
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
        refundAmount: actualRefund,
        refundNote,
      });
      smsSent = r.ok;
      if (!r.ok) console.error("[hotel-cancel] 취소 문자 발송 실패:", r.error);
    } catch (e) {
      console.error("[hotel-cancel] 취소 문자 예외:", e);
    }
  }

  return { ok: true, refunded: actualRefund > 0, refundAmount: actualRefund, refundNote, smsSent };
}
