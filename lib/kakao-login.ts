import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import { SITES, siteFromHost, type SiteKey } from "@/lib/sites";

export const KAKAO_FLOW_COOKIE = "kakao_login_flow";
export type LoginFlow = { site: SiteKey; return_path: string };
export const loginHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const loginNonce = () => randomBytes(32).toString("hex");
export function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid" || parsed.pathname.startsWith("/api/auth/")) return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return "/"; }
}
export function loginOrigin(req: NextRequest, site: SiteKey) {
  return process.env.NODE_ENV === "production" ? `https://${SITES[site].host}` : req.nextUrl.origin;
}
export function flowCookieOptions(req: NextRequest) {
  // 등록된 Shop 콜백과 산지픽이 일회성 로그인 검증값만 공유한다. 세션 쿠키는 호스트 전용이다.
  const host = req.nextUrl.hostname;
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
    path: "/api/auth/kakao", maxAge: 600,
    ...(host.endsWith(".blendpunch.com") ? { domain: ".blendpunch.com" } : {}) };
}
export function loginResponse(req: NextRequest, flow: LoginFlow, token: string) {
  const res = NextResponse.redirect(new URL(safeReturnPath(flow.return_path), loginOrigin(req, flow.site)));
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.cookies.set("shop_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60, path: "/" });
  res.cookies.set("admin_token", "", { maxAge: 0, path: "/" });
  res.cookies.set(KAKAO_FLOW_COOKIE, "", { ...flowCookieOptions(req), maxAge: 0 });
  return res;
}
export function loginFailure(req: NextRequest, reason: string, flow?: LoginFlow) {
  const site = flow?.site ?? siteFromHost(req.headers.get("host"));
  const url = new URL("/login", loginOrigin(req, site));
  url.searchParams.set("error", reason);
  if (flow) url.searchParams.set("redirect", safeReturnPath(flow.return_path));
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.cookies.set(KAKAO_FLOW_COOKIE, "", { ...flowCookieOptions(req), maxAge: 0 });
  return res;
}
export async function completeOrRelay(req: NextRequest, flow: LoginFlow, token: string, state: string) {
  if (siteFromHost(req.headers.get("host")) === flow.site || process.env.NODE_ENV !== "production") return loginResponse(req, flow, token);
  const code = loginNonce();
  await shopPool.query(
    "INSERT INTO oauth_login_handoffs (code_hash, state_hash, site, return_path, session_token, expires_at) VALUES ($1,$2,$3,$4,$5,NOW() + INTERVAL '60 seconds')",
    [loginHash(code), loginHash(state), flow.site, flow.return_path, token]
  );
  const url = new URL("/api/auth/kakao/complete", loginOrigin(req, flow.site));
  url.searchParams.set("code", code);
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
