/**
 * 샵 상품 판매 단가 규칙.
 *
 * 옵션이 있으면 옵션 가격(extra_price)이 곧 판매 단가이고(기본가에 더하지 않음),
 * 옵션이 없으면 기본가(price)를 그대로 사용한다.
 * 상세·장바구니·결제 전 구간에서 이 함수를 공유해 가격 계산을 일치시킨다.
 */
export function shopUnitPrice(
  basePrice: number,
  extraPrice: number | null | undefined,
  hasOption: boolean
): number {
  return hasOption && extraPrice != null ? extraPrice : basePrice;
}
