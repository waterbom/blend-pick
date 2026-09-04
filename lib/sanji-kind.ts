// 산지픽 상품 구분 — 카테고리 문자열로 농산물/해산물을 나눈다 (클라이언트에서도 쓰므로 DB 의존 없음).
// 상품 관리 카테고리: '산지픽' 또는 '산지픽 농산물' → 농산물, '산지픽 해산물' → 해산물.

export type SanjiKind = "produce" | "seafood";

export const SANJI_KIND_LABEL: Record<SanjiKind, string> = { produce: "농산물", seafood: "해산물" };

export function sanjiKind(category: string | null | undefined): SanjiKind {
  const c = (category || "").replace(/\s+/g, "");
  return /해산물|수산|해물/.test(c) ? "seafood" : "produce";
}
