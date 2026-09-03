import { NextRequest, NextResponse } from "next/server";
import { SITES, siteFromHost, siteFromPath } from "@/lib/sites";

// Next 16 proxy (구 middleware) — 두 가지 일을 한다.
// 1) /admin/* 접근 시 admin_token 확인
// 2) 멀티 사이트: 산지픽 도메인으로 들어온 요청을 /sanji/* 로 내부 리라이트하고 x-site 헤더를 붙인다.
//    · 산지픽 도메인의 "/"        → /sanji (홈)
//    · 산지픽 도메인의 "/about"   → /sanji/about (산지픽 전용 페이지가 있으면)
//    · /api, /_next, 정적 파일, 공용 페이지(/products, /checkout, /login …)는 그대로 — 두 사이트가 공유
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const adminToken = req.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  const host = req.headers.get("host");
  const site = siteFromHost(host) === "sanjipick" ? "sanjipick" : siteFromPath(pathname);

  // 다운스트림(서버 컴포넌트)이 어느 사이트인지 알 수 있게 요청 헤더에 표시
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-site", site);
  reqHeaders.set("x-pathname", pathname);

  if (siteFromHost(host) === "sanjipick") {
    const bp = SITES.sanjipick.basePath;
    const alreadyPrefixed = pathname === bp || pathname.startsWith(bp + "/");
    const shared =
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/admin") ||
      /\.[a-zA-Z0-9]+$/.test(pathname); // 파일 확장자가 있는 정적 자원
    if (!alreadyPrefixed && !shared && SANJI_OWN_PATHS.has(firstSegment(pathname))) {
      const url = req.nextUrl.clone();
      url.pathname = bp + (pathname === "/" ? "" : pathname);
      return NextResponse.rewrite(url, { request: { headers: reqHeaders } });
    }
  }

  return NextResponse.next({ request: { headers: reqHeaders } });
}

// 산지픽 도메인에서 산지픽 전용 페이지로 리라이트할 1차 경로 — 그 외(/products, /cart, /checkout, /login, /mypage …)는 공용
// ★ app/sanji/ 아래에 페이지를 추가하면 여기에도 세그먼트를 등록
const SANJI_OWN_PATHS = new Set<string>([""]);

function firstSegment(pathname: string) {
  return pathname.split("/")[1] ?? "";
}

export const config = {
  // _next 내부 자원과 파비콘 등은 제외 — 나머지 전 경로에서 실행 (사이트 판별 헤더를 항상 붙이기 위해)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
