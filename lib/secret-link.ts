import { shopUnitPrice } from "@/lib/shop-price";
import { SITES } from "@/lib/sites";

/**
 * 비밀링크(비전시 판매) 가격 규칙 — 서버·클라이언트 공용 (DB 접근 없음).
 *
 *  · 전시가(price)  : 메인·목록·상세에 보이는 가격
 *  · 링크가(link_price): 상품 관리에서 발급한 비밀링크(?k=코드)로 들어왔을 때만 적용되는 가격
 *  · 비밀링크 코드가 상품의 link_code 와 일치하고 link_price 가 있어야만 링크가가 붙는다.
 *
 * 옵션 상품은 옵션가가 곧 판매 단가(shopUnitPrice)라서, 링크가는 "전시가 대비 차액"으로 옵션가에 똑같이 반영한다.
 *   예) 전시가 29,900 · 링크가 24,900 → 모든 옵션 5,000원씩 저렴 (옵션 없는 상품은 링크가 그대로)
 * 상세·결제 화면·승인 전 금액 검증(lib/order-amount.ts)이 전부 이 함수를 써서 계산이 어긋나지 않는다.
 */

export const LINK_PARAM = "k";
const CODE_RE = /^[a-z0-9]{8,32}$/;

export interface LinkPriced { price: number; link_price?: number | null; link_code?: string | null }

// URL 로 들어온 코드 정리 — 형식이 다르면 null (DB 대조 전에 잡음 제거)
export function cleanLinkCode(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return CODE_RE.test(s) ? s : null;
}

// 이 상품에 이 코드로 링크가가 적용되는가
export function linkApplies(p: LinkPriced, code: string | null | undefined): boolean {
  return !!code && !!p.link_code && p.link_code === code && p.link_price != null;
}

// 링크가 적용 시 전시가 대비 차액 (링크가 − 전시가). 적용 안 되면 0.
export function linkDelta(p: LinkPriced, code: string | null | undefined): number {
  return linkApplies(p, code) ? Number(p.link_price) - Number(p.price) : 0;
}

// 판매 단가 — 기본 규칙(shopUnitPrice)에 링크 차액을 더한 값 (0원 미만 방지)
export function linkedUnitPrice(basePrice: number, extraPrice: number | null | undefined, hasOption: boolean, delta: number): number {
  return Math.max(0, shopUnitPrice(basePrice, extraPrice, hasOption) + delta);
}

// 산지픽 비밀링크 주소 — 정식 도메인의 개별 판매 페이지 + 코드
export function sanjiSecretLinkUrl(productId: string, code: string): string {
  return `https://${SITES.sanjipick.host}/p/${productId}?${LINK_PARAM}=${code}`;
}
