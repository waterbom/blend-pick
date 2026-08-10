import type { MetadataRoute } from "next";

// 검색엔진 수집 규칙 — 상품·공구 페이지는 열고, 관리자·결제·개인 페이지는 막는다.
// /c/ (인플루언서 전용 링크)는 검색에 뜨면 무관한 유입까지 실적 귀속되므로 차단.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/api/", "/mypage", "/cart", "/checkout",
          "/pay/", "/orders/", "/login", "/signup", "/influencer",
          "/hotel-roster", "/hotel/lookup", "/c/",
        ],
      },
    ],
    sitemap: "https://shop.blendpunch.com/sitemap.xml",
  };
}
