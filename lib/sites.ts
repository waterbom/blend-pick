// 멀티 사이트(브랜드) 설정 — 한 코드베이스로 블랜드픽·산지픽을 도메인별로 서빙한다.
//
// 흐름: proxy.ts가 요청 호스트를 보고 산지픽이면 `/sanji/*`로 내부 리라이트 + `x-site` 헤더를 붙인다.
// 서버 컴포넌트는 currentSite()로 어느 사이트인지 알 수 있다.
//
// ★ 새 브랜드가 생기면: SiteKey 추가 + SITES에 항목 추가 + app/<basePath>/ 페이지 작성 + proxy.ts 호스트 매핑.

export type SiteKey = "blendpick" | "sanjipick";

export interface SiteConfig {
  key: SiteKey;
  name: string;        // 한글 브랜드명
  nameEn: string;      // 로고 표기
  host: string;        // 서빙 도메인
  basePath: string;    // 내부 라우트 프리픽스 ("" = 루트)
  tagline: string;
  description: string;
  categories: string[]; // products_shop.category 중 이 사이트에 노출할 카테고리 (빈 배열 = 전체)
  kakaoUrl: string;
}

const KAKAO = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";

export const SITES: Record<SiteKey, SiteConfig> = {
  blendpick: {
    key: "blendpick",
    name: "블랜드픽",
    nameEn: "BLEND PICK",
    host: process.env.NEXT_PUBLIC_SITE_HOST || "shop.blendpunch.com",
    basePath: "",
    tagline: "인플루언서 공구 플랫폼",
    description: "인플루언서와 함께하는 공동구매 — 블랜드픽",
    categories: [],
    kakaoUrl: KAKAO,
  },
  sanjipick: {
    key: "sanjipick",
    name: "산지픽",
    nameEn: "SANJI PICK",
    host: process.env.NEXT_PUBLIC_SANJI_HOST || "sanjipick.blendpunch.com",
    basePath: "/sanji",
    tagline: "산지에서 바로, 제철 그대로",
    description: "농가에서 바로 보내는 제철 농산물 공동구매 — 산지픽",
    // 상품 관리에서 카테고리를 이 중 하나로 지정한 상품만 산지픽에 노출
    // '산지픽'·'산지픽 농산물' = 농산물 탭, '산지픽 해산물' = 해산물 탭 (lib/sanji-kind.ts)
    categories: ["산지픽", "산지픽 농산물", "산지픽 해산물"],
    kakaoUrl: process.env.NEXT_PUBLIC_SANJI_KAKAO_URL || KAKAO,
  },
};

// 산지픽으로 취급할 호스트 — 정식 도메인 + 예전/별칭 도메인 (DNS가 남아있어도 같은 사이트로)
const SANJI_HOST_ALIASES = ["sanji.blendpunch.com"];

// 요청 호스트 → 사이트 (포트 제거 후 비교, 기본은 블랜드픽)
export function siteFromHost(host: string | null | undefined): SiteKey {
  const h = (host || "").split(":")[0].toLowerCase();
  if (h && (h === SITES.sanjipick.host.toLowerCase() || SANJI_HOST_ALIASES.includes(h))) return "sanjipick";
  return "blendpick";
}

// 경로 프리픽스 → 사이트 (로컬에서 /sanji 로 직접 열었을 때도 산지픽으로 취급)
export function siteFromPath(pathname: string): SiteKey {
  const bp = SITES.sanjipick.basePath;
  if (pathname === bp || pathname.startsWith(bp + "/")) return "sanjipick";
  return "blendpick";
}

// 산지픽 팔레트 — 흙·밭·햇살 (블랜드픽 딥 포레스트와 결이 같되 더 따뜻하게)
export const SANJI = {
  soil: "#3E2A1E",      // 진한 흙색 — 제목·강조
  soil700: "#5A3E2B",
  field: "#3F6B3A",     // 밭 초록 — 액센트
  field600: "#4E8447",
  sun: "#E8A33D",       // 햇살 — 배지·포인트
  sunSoft: "#FBEFD9",
  cream: "#FAF6EE",     // 바탕
  paper: "#FFFDF8",
  hairline: "#E9E1D2",
  muted: "#7A6A5B",
} as const;
