import { sendSMS } from "@/lib/sms";

export interface ReturnRefundSMSData {
  buyerName: string;
  orderNumber: string;
  refundAmount: number;
}

// 반품 완료(환불) 안내 문자 본문 — 어드민 반품 완료 처리 시 자동 발송
export function returnRefundSMSText(p: ReturnRefundSMSData) {
  return (
    `[블랜드픽] 반품 환불 안내\n\n` +
    `${p.buyerName || "고객"}님, 반품 처리가 완료되었습니다.\n\n` +
    `▪ 주문번호: ${p.orderNumber}\n` +
    `▪ 환불금액: ${Number(p.refundAmount).toLocaleString()}원\n\n` +
    `환불 금액은 카드사에 따라\n` +
    `영업일 기준 3~5일 소요될 수 있습니다.\n` +
    `문의사항은 카카오 채널로 연락 부탁드립니다.`
  );
}

export async function sendReturnRefundSMS(phone: string, p: ReturnRefundSMSData) {
  return sendSMS(phone, returnRefundSMSText(p), "반품 환불 안내");
}
