import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/login은 통과
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  // /admin/* 접근 시 admin_token 확인
  if (pathname.startsWith("/admin")) {
    const adminToken = req.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
