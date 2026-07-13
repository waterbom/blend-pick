import { HOTEL } from "@/lib/hotel";
import { sendSMS } from "@/lib/sms";

export interface ReservationSMSData {
  buyerName: string;
  orderNumber: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
}

// 예약확인 문자 본문 (자동발송·일괄발송 공통)
export function reservationSMSText(p: ReservationSMSData) {
  return (
    `[${HOTEL.name}] 예약 확인\n\n` +
    `${p.buyerName || "고객"}님, 예약이 확정되었습니다.\n\n` +
    `▪ 예약번호: ${p.orderNumber}\n` +
    `▪ 객실: ${p.room}\n` +
    `▪ 투숙: ${p.checkIn} ~ ${p.checkOut} (${p.nights}박)\n` +
    `▪ 결제금액: ${Number(p.total).toLocaleString()}원\n\n` +
    `체크인 시 호텔 프런트에 본 문자를 보여주시면 입장 가능합니다.\n` +
    `(예약번호·예약자 성함으로 확인)`
  );
}

export async function sendReservationSMS(phone: string, p: ReservationSMSData) {
  return sendSMS(phone, reservationSMSText(p), "예약 확인");
}

// 예약취소 문자 본문 (관리자 취소 → 토스 환불 완료 후 발송)
export function cancellationSMSText(p: ReservationSMSData) {
  return (
    `[${HOTEL.name}] 예약 취소\n\n` +
    `${p.buyerName || "고객"}님, 예약이 취소되었습니다.\n\n` +
    `▪ 예약번호: ${p.orderNumber}\n` +
    `▪ 객실: ${p.room}\n` +
    `▪ 투숙: ${p.checkIn} ~ ${p.checkOut} (${p.nights}박)\n` +
    `▪ 결제금액: ${Number(p.total).toLocaleString()}원\n\n` +
    `결제하신 금액은 환불 규정에 따라 환불 처리되며,\n` +
    `카드사에 따라 영업일 기준 3~5일 소요될 수 있습니다.\n` +
    `문의사항은 카카오 채널로 연락 부탁드립니다.`
  );
}

export async function sendCancellationSMS(phone: string, p: ReservationSMSData) {
  return sendSMS(phone, cancellationSMSText(p), "예약 취소");
}
