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

export function returnRequestStatus(status: string) {
  return ['shipped','delivered','exchange_completed','return_completed'].includes(status);
}

export interface ReturnRefundQuote {
  items: Pick<ReturnItem, "unit_price" | "quantity">[];
  total_amount: number;
  fee_agreed: boolean;
  return_cost_roundtrip: number | null;
  recorded_refunds: number;
  pending_refunds: boolean;
  refund_amount_unresolved: boolean;
  order_status: string;
}

// A previous refund may belong to the same items. It needs individual reconciliation.
export function bulkReturnAmount(row: ReturnRefundQuote): number | null {
  if (row.order_status !== "return_requested" || row.refund_amount_unresolved || row.pending_refunds ||
      Number(row.recorded_refunds) !== 0 || !Array.isArray(row.items) || !row.items.length) return null;
  if (row.items.some(item => !item || item.unit_price == null || !Number.isSafeInteger(Number(item.unit_price)) ||
      Number(item.unit_price) < 0 || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1)) return null;
  const goods = row.items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  if (!Number.isSafeInteger(goods) || typeof row.fee_agreed !== "boolean" || (row.fee_agreed && row.return_cost_roundtrip == null)) return null;
  const cost = row.fee_agreed ? Number(row.return_cost_roundtrip) : 0;
  if (!Number.isSafeInteger(cost) || cost < 0) return null;
  const amount = Math.min(goods - cost, Number(row.total_amount));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
