import type { SanjiCard } from "@/lib/sanji-data";

// 산지픽 메인 상단 배너 — public/sanji/banners/ 에 아래 파일명 그대로 올리면 된다 (1200×760 권장, PNG).
// 3초마다 자동으로 넘어가고, 누르면 상품 상세(/p/<id>)로 간다.
//   - productId 를 적어두면 그 상품으로 바로 연결
//   - 없으면 keyword 가 상품명에 들어있는 산지픽 상품(등록순 최신) 을 찾아 연결, 그것도 없으면 메인 상품 목록으로
export interface SanjiBanner {
  file: string;      // public/sanji/banners/ 아래 파일명
  alt: string;
  keyword: string;   // 상품명 매칭 키워드
  productId?: string;
}

export const SANJI_BANNERS: SanjiBanner[] = [
  { file: "01-햇감자.png", alt: "카스테라 포슬포슬 햇감자 — GAP 인증 괴산 노지 재배 홍감자", keyword: "감자" },
  { file: "02-복숭아.png", alt: "한 입에 꿀 대향금 복숭아 — 고당도 황도, 수확 당일 산지 직송", keyword: "복숭아" },
  { file: "03-단호박.png", alt: "달콤 숙성 미니 밤 단호박 — 큐어링으로 끌어올린 당도", keyword: "단호박" },
  { file: "04-배도라지즙.png", alt: "목이 편한 클래식 배도라지즙 — 국산 배 95% · 도라지 5%", keyword: "도라지" },
  { file: "05-사과.png", alt: "아삭 달콤 부사 사과 특대과 — 괴산 6대째 청년농부의 선물용 12과", keyword: "사과" },
];

export function bannerSrc(b: SanjiBanner) {
  return "/sanji/banners/" + encodeURIComponent(b.file);
}

// 배너 → 연결할 상품 (없으면 null → 메인 상품 목록으로)
export function bannerTarget(b: SanjiBanner, products: SanjiCard[]): SanjiCard | null {
  if (b.productId) return products.find((p) => p.id === b.productId) ?? ({ id: b.productId } as SanjiCard);
  return products.find((p) => p.name.includes(b.keyword)) ?? null;
}
