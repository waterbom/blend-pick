// 배송비 계산 — 상품 상세·단품 결제·장바구니가 전부 이 함수를 쓴다 (어드민 배송비 설정과 1:1)
//
// shipping_type
//  · free              : 무료
//  · paid              : shipping_cost 고정
//  · conditional_free  : 상품 금액이 free_shipping_threshold 이상이면 무료, 미만이면 shipping_cost
//  · per_unit          : 1건 무료, 2건째부터 건당 per_unit_shipping_cost 추가 (합배송)

export interface ShippingRule {
  shipping_type: string;
  shipping_cost: number | null;
  free_shipping_threshold?: number | null;
  per_unit_shipping_cost?: number | null;
}

// 한 상품 기준 배송비 — qty: 그 상품 총 수량(옵션 합산), subtotal: 그 상품 금액 합
export function productShippingFee(r: ShippingRule, qty: number, subtotal: number): number {
  const cost = Number(r.shipping_cost) || 0;
  switch (r.shipping_type) {
    case "free":
      return 0;
    case "conditional_free": {
      const th = Number(r.free_shipping_threshold) || 0;
      return th > 0 && subtotal >= th ? 0 : cost;
    }
    case "per_unit": {
      const per = Number(r.per_unit_shipping_cost) || 0;
      return Math.max(0, qty - 1) * per;
    }
    default: // paid
      return cost;
  }
}

// 상품 상세 배송 안내 문구
export function shippingLabel(r: ShippingRule): string {
  const cost = Number(r.shipping_cost) || 0;
  switch (r.shipping_type) {
    case "free":
      return "무료배송";
    case "conditional_free": {
      const th = Number(r.free_shipping_threshold) || 0;
      return th > 0
        ? `${th.toLocaleString()}원 이상 무료배송 (미만 ${cost.toLocaleString()}원)`
        : `배송비 ${cost.toLocaleString()}원`;
    }
    case "per_unit": {
      const per = Number(r.per_unit_shipping_cost) || 0;
      return `1건 무료배송 · 2건째부터 건당 ${per.toLocaleString()}원`;
    }
    default:
      return `배송비 ${cost.toLocaleString()}원`;
  }
}

export interface CartFeeItem extends ShippingRule {
  product_id: string;
  quantity: number;
  unit_price: number; // 옵션 추가금 반영된 단가
}

// 장바구니 배송비 — 같은 상품(옵션 여러 개)은 한 묶음으로 계산.
//  · paid / conditional_free(미달): 여러 상품이 섞여도 배송비는 한 번만 (가장 큰 값) — 기존 동작 유지
//  · per_unit: 상품별로 (수량−1)×건별 배송비를 각각 더함
export function cartShippingFee(items: CartFeeItem[]): number {
  const groups = new Map<string, { rule: ShippingRule; qty: number; subtotal: number }>();
  for (const it of items) {
    const g = groups.get(it.product_id) ?? { rule: it, qty: 0, subtotal: 0 };
    g.qty += it.quantity;
    g.subtotal += it.unit_price * it.quantity;
    groups.set(it.product_id, g);
  }
  let flat = 0;
  let perUnit = 0;
  for (const g of groups.values()) {
    const fee = productShippingFee(g.rule, g.qty, g.subtotal);
    if (g.rule.shipping_type === "per_unit") perUnit += fee;
    else flat = Math.max(flat, fee);
  }
  return flat + perUnit;
}
