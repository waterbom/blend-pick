import { sendSMS } from "@/lib/sms";
import { carrierName, trackingUrl } from "@/lib/carriers";

export interface ShipmentSMSData {
  buyerName: string;
  orderNumber: string;
  carrier: string | null; // 택배사 코드 또는 이름
  trackingNumber: string;
}

// 발송(배송 출발) 안내 문자 본문 — 운송장 등록 시 자동 발송
export function shipmentSMSText(p: ShipmentSMSData) {
  return (
    `[블랜드픽] 상품 발송 안내\n\n` +
    `${p.buyerName || "고객"}님, 주문하신 상품이 출발했어요.\n\n` +
    `▪ 주문번호: ${p.orderNumber}\n` +
    `▪ 택배사: ${carrierName(p.carrier)}\n` +
    `▪ 운송장번호: ${p.trackingNumber}\n\n` +
    `배송조회: ${trackingUrl(p.carrier, p.trackingNumber)}`
  );
}

export async function sendShipmentSMS(phone: string, p: ShipmentSMSData) {
  return sendSMS(phone, shipmentSMSText(p), "상품 발송 안내");
}
