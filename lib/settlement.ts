/**
 * 인플루언서 정산 / 손익 계산 공통 모듈
 *
 * 모든 돈 계산은 이 파일을 거친다. 반올림은 전부 Math.round (원 단위).
 * 클라이언트 확정 예시로 검증: 3,500,000 × 10% → 수수료 350,000
 *   간이:   공급가액 318,182 / 부가세 31,818 → 지급 318,182
 *   프리랜서: 공급가액 318,182 → 원천징수 10,500 → 지급 307,682
 *
 * 수수료/손익 기준 매출 = 주문 total_amount − shipping_fee (고객부담 배송비 제외)
 * 집계 대상 주문 상태 = paid/confirmed/preparing/shipped/delivered (취소 제외)
 * 반올림 시점 = 공구 단위 집계 후 (주문별 아님)
 */

export type BusinessType = "general" | "simplified" | "freelancer";

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  general: "일반사업자",
  simplified: "간이사업자",
  freelancer: "프리랜서",
};

/** 손익/정산 집계에 포함되는 주문 상태 (SQL IN 절용) */
export const COUNTABLE_ORDER_STATUSES = [
  "paid",
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
    // 일반사업자: 부가세 차감 없이 전액 지급 (인플루언서가 세금계산서 발행)
    return { commission, supplyValue: commission, vat: 0, withholding: 0, payout: commission };
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

/** 매출부가세 = round(총매출 × 10/110) — 판매가는 부가세 포함가 */
export function calcSalesVat(gross: number): number {
  return Math.round((gross * 10) / 110);
}

/** 회사 순이익 (손익표 한 행) */
export function calcNetProfit(r: {
  gross: number;        // 총매출 (배송비 제외 상품매출)
  supplyCost: number;   // 공급가 합계
  shippingCost: number; // 배송비 (공구별 비용 중 shipping 카테고리)
  pgFee: number;        // PG수수료
  otherCosts: number;   // 기타비용 (shipping 제외 카테고리 합)
  commission: number;   // 인플루언서 수수료
}): number {
  return (
    r.gross -
    calcSalesVat(r.gross) -
    r.supplyCost -
    r.shippingCost -
    r.pgFee -
    r.otherCosts -
    r.commission
  );
}

export const COST_CATEGORY_LABEL: Record<string, string> = {
  shipping: "배송비",
  ad: "광고비",
  sample: "샘플비",
  etc: "기타",
};
