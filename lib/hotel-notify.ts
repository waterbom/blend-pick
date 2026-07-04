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
    `체크인 시 예약자 성함으로 확인됩니다.`
  );
}

export async function sendReservationSMS(phone: string, p: ReservationSMSData) {
  return sendSMS(phone, reservationSMSText(p), "예약 확인");
}
