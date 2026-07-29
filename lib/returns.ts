// 교환·반품 공용 상수 — 고객 폼 / 신청 API / 관리자 화면이 같은 값을 쓴다

export const RETURN_REASONS = [
  "단순 변심",
  "상품 불량·파손",
  "오배송 (주문과 다른 상품)",
  "구성품 누락",
  "기타",
] as const;

// 판매자 귀책 사유 — 이 경우 교환·반품 배송비는 판매자 부담 (고객 동의 불필요)
export const SELLER_FAULT_REASONS: readonly string[] = [
  "상품 불량·파손",
  "오배송 (주문과 다른 상품)",
  "구성품 누락",
];

export const RETURN_KIND_LABEL: Record<string, string> = {
  exchange: "교환",
  return: "반품",
};

// 4단계: 신청 접수 → 수거·처리 중 → 완료 / 거절
export const RETURN_STATUS_LABEL: Record<string, string> = {
  requested: "신청 접수",
  collecting: "수거·처리 중",
  done: "완료",
  rejected: "거절",
};

export interface ReturnItem {
  item_id: string;
  product_name: string;
  option_label: string | null;
  unit_price: number;
  quantity: number;
}
