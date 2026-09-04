import { SITES } from "@/lib/sites";

// 산지픽 도메인의 robots.txt — proxy.ts가 sanjipick.blendpunch.com/robots.txt 를 여기로 보낸다.
// (robots.ts 파일 규칙은 app 루트에서만 동작해서 라우트 핸들러로 직접 응답)
// 상품·소개 페이지는 열고, 관리자·결제·개인 페이지는 막는다. 사이트맵은 산지픽 전용(app/sanji/sitemap.ts).
export const dynamic = "force-static";

export function GET() {
  const base = `https://${SITES.sanjipick.host}`;
  const disallow = [
    "/admin", "/api/", "/mypage", "/cart", "/checkout",
    "/pay/", "/orders/", "/login", "/signup", "/influencer",
    "/hotel", "/hotel-roster", "/c/", "/sanji/",
  ];
  const body = ["User-Agent: *", "Allow: /", ...disallow.map((d) => `Disallow: ${d}`), "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
