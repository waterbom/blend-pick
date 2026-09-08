/** 지급액의 사업자유형별 분해와 화면 공통 상수.
 * 관리자 재무 집계는 order-finance.ts / influencer-finance.ts에서
 * 주문 당시 금액·요율과 실제 환불 기록을 사용한다.
 */

export type BusinessType = "general" | "simplified" | "freelancer";

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  general: "일반사업자",
  simplified: "간이사업자",
  freelancer: "프리랜서",
};

/** 기존 회원/인플루언서 활동 화면용 상태 목록. 재무 정산 필터로 사용하지 않는다. */
// awaiting = 예약대기(결제 완료·승인 전) — 돈은 받았으므로 매출·정산에 포함, 취소 시 자동 제외
// checked_in = 입실 완료 — 매출 확정 상태이므로 당연히 포함 (빠지면 입실 처리 순간 매출이 증발)
// no_show = 미입실 — 환불하지 않으므로 매출 유지 (환불해줄 경우 취소 처리하면 자동 제외)
export const COUNTABLE_ORDER_STATUSES = [
  "awaiting",
  "paid",
  "checked_in",
  "no_show",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
] as const;

/** 원천징수율 (프리랜서) */
export const WITHHOLDING_RATE = 0.033;

/** 수수료 = round(총매출 × 요율%) */
export function calcCommission(grossSales: number, ratePercent: number): number {
  return Math.round(grossSales * (ratePercent / 100));
}

export interface PayoutBreakdown {
  commission: number;   // 수수료
  supplyValue: number;  // 공급가액
  vat: number;          // 부가세
  withholding: number;  // 원천징수 (프리랜서만)
  payout: number;       // 최종 지급액
}

/** 사업자유형별 지급액 분해 */
export function calcPayout(commission: number, type: BusinessType): PayoutBreakdown {
  if (type === "general") {
    // 일반사업자: 수수료 전액 지급 (세금계산서 발행) — 공급가액/부가세는 표시용 분해
    const supplyValue = Math.round(commission / 1.1);
    return { commission, supplyValue, vat: commission - supplyValue, withholding: 0, payout: commission };
  }
  const supplyValue = Math.round(commission / 1.1);
  const vat = commission - supplyValue;
  if (type === "simplified") {
    // 간이사업자: 공급가액만 지급 (증빙: 현금영수증)
    return { commission, supplyValue, vat, withholding: 0, payout: supplyValue };
  }
  // 프리랜서: 공급가액 기준 원천징수 3.3% 추가 공제
  const withholding = Math.round(supplyValue * WITHHOLDING_RATE);
  return { commission, supplyValue, vat, withholding, payout: supplyValue - withholding };
}

/**
 * 호텔공구 (여수 UTOP) — 모든 인플루언서 공통 요율, 수기 상수.
 * 추후 호텔공구 생성 페이지에서 요율을 입력받는 구조로 대체 예정.
 */
export const HOTEL_COMMISSION_RATE = 5;
/** influencer_payouts용 호텔 버킷 센티널 (campaign_id NOT NULL 제약 대응) */
export const HOTEL_PAYOUT_CAMPAIGN_ID = "00000000-0000-0000-0000-000000000001";
export const HOTEL_LABEL = "호텔공구 × 여수 UTOP 마리나 호텔";

export const COST_CATEGORY_LABEL: Record<string, string> = {
  shipping: "배송비",
  ad: "광고비",
  sample: "샘플비",
  etc: "기타",
};
