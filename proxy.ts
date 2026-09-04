import { NextRequest, NextResponse } from "next/server";
import { SITES, siteFromHost, siteFromPath, type SiteKey } from "@/lib/sites";

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
  const sanjiHost = siteFromHost(host) === "sanjipick";
  const seg = firstSegment(pathname);
  let site: SiteKey = sanjiHost ? "sanjipick" : siteFromPath(pathname);

  // 미리보기 모드 — shop 도메인에서 /sanji 로 산지픽을 보다가 공용 페이지(로그인·마이페이지·장바구니·결제…)로
  // 넘어가면 도메인상으론 블랜드픽이라 테마가 바뀐다. /sanji 를 거친 브라우저에 쿠키를 심어 두고,
  // 공용 페이지에서는 그 쿠키로 산지픽 테마를 유지한다. 블랜드픽 고유 페이지(/, /hotel, /influencer)로 가면 해제.
  // API 호출(결제 확정 등)도 미리보기 중이면 산지픽으로 표시 — orders.site 기록 기준
  const preview = !sanjiHost && req.cookies.get(PREVIEW_COOKIE)?.value === "1";
  if (preview && site === "blendpick" && (PREVIEW_SHARED.has(seg) || seg === "api")) site = "sanjipick";

  // 다운스트림(서버 컴포넌트)이 어느 사이트인지 알 수 있게 요청 헤더에 표시
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-site", site);
  reqHeaders.set("x-pathname", pathname);

  let res: NextResponse;
  if (sanjiHost) {
    const bp = SITES.sanjipick.basePath;
    const alreadyPrefixed = pathname === bp || pathname.startsWith(bp + "/");
    const shared =
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/admin") ||
      /\.[a-zA-Z0-9]+$/.test(pathname); // 파일 확장자가 있는 정적 자원
    // /products 목록만 산지픽 전용 (검색) — /products/<id>, /products/<id>/checkout 은 공용 그대로
    const ownList = pathname === "/products";
    if (!alreadyPrefixed && !shared && (SANJI_OWN_PATHS.has(seg) || ownList)) {
      const url = req.nextUrl.clone();
      url.pathname = bp + (pathname === "/" ? "" : pathname);
      res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
    } else {
      res = NextResponse.next({ request: { headers: reqHeaders } });
    }
  } else {
    res = NextResponse.next({ request: { headers: reqHeaders } });
    if (siteFromPath(pathname) === "sanjipick") {
      res.cookies.set(PREVIEW_COOKIE, "1", { path: "/", sameSite: "lax" });
    } else if (preview && (pathname === "/" || PREVIEW_CLEAR.has(seg))) {
      res.cookies.set(PREVIEW_COOKIE, "", { path: "/", maxAge: 0 });
    }
  }
  return res;
}

// shop 도메인 미리보기 쿠키 — /sanji 방문 시 심고, 블랜드픽 고유 페이지로 가면 지운다
const PREVIEW_COOKIE = "sj_preview";
// 쿠키가 있을 때 산지픽 테마로 보여줄 공용 1차 경로
const PREVIEW_SHARED = new Set<string>(["login", "signup", "mypage", "cart", "checkout", "orders", "pay", "products", "terms", "privacy", "guide"]);
// 여기로 오면 미리보기 해제 (블랜드픽 고유 영역)
const PREVIEW_CLEAR = new Set<string>(["hotel", "influencer", "campaigns", "admin"]);

// 산지픽 도메인에서 산지픽 전용 페이지로 리라이트할 1차 경로 — 그 외(/products, /cart, /checkout, /login, /mypage …)는 공용
// ★ app/sanji/ 아래에 페이지를 추가하면 여기에도 세그먼트를 등록
//   ""      → /sanji        (루트 = 대표 상품 판매 페이지)
//   "p"     → /sanji/p/<id> (개별 상품 판매 페이지)
//   "about" → /sanji/about  (브랜드 소개 — 예전 랜딩)
//   (정확히 "/products" 만) → /sanji/products (산지픽 전체 상품·검색) — proxy() 안에서 별도 처리
const SANJI_OWN_PATHS = new Set<string>(["", "p", "about"]);

function firstSegment(pathname: string) {
  return pathname.split("/")[1] ?? "";
}

export const config = {
  // _next 내부 자원과 파비콘 등은 제외 — 나머지 전 경로에서 실행 (사이트 판별 헤더를 항상 붙이기 위해)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
