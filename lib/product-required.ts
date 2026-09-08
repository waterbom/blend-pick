// 상품 등록·수정 필수값 검사 — 등록 API(POST)와 수정 API(PATCH)가 같은 기준을 쓴다.
// 공급가(매입원가)가 비면 손익 집계에서 그 상품이 담긴 주문이 통째로 빠지므로, 저장 단계에서 막는다.

// 상품 공급가가 있거나, 판매중 옵션 전부에 옵션 공급가가 있어야 통과. 누락이면 안내문 반환 (통과면 null)
export function missingSupply(supplyPrice: unknown, options: unknown): string | null {
  const has = (v: unknown) => v != null && v !== "" && !Number.isNaN(Number(v));
  if (has(supplyPrice)) return null;
  const active = (Array.isArray(options) ? options : []).filter(
    (o: { name?: string; active?: boolean }) => o?.name && o.active !== false
  ) as { supply_price?: unknown }[];
  if (active.length > 0 && active.every((o) => has(o.supply_price))) return null;
  return active.length > 0
    ? "공급가(매입원가)를 입력해주세요. 상품 공급가를 넣거나, 판매중 옵션마다 공급가를 넣어주세요."
    : "공급가(매입원가)를 입력해주세요. 비어 있으면 손익 집계에서 이 상품 주문이 빠져요.";
}
