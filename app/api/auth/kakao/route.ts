import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import { siteFromHost } from "@/lib/sites";
import { KAKAO_FLOW_COOKIE, safeReturnPath, loginNonce, loginHash, flowCookieOptions } from "@/lib/kakao-login";

export async function GET(req: NextRequest) {
  if (!process.env.KAKAO_CLIENT_ID || !process.env.KAKAO_REDIRECT_URI) return NextResponse.json({ error: "카카오 로그인 설정을 확인해주세요." }, { status: 503 });
  const state = loginNonce();
  const site = siteFromHost(req.headers.get("host"));
  const returnPath = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  await shopPool.query("DELETE FROM oauth_login_flows WHERE expires_at < NOW()");
  await shopPool.query("DELETE FROM oauth_login_handoffs WHERE expires_at < NOW()");
  await shopPool.query(
    "INSERT INTO oauth_login_flows (state_hash, site, return_path, expires_at) VALUES ($1,$2,$3,NOW() + INTERVAL '10 minutes')",
    [loginHash(state), site, returnPath]
  );
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.KAKAO_CLIENT_ID);
  url.searchParams.set("redirect_uri", process.env.KAKAO_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile_nickname profile_image talk_message");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set(KAKAO_FLOW_COOKIE, state, flowCookieOptions(req));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
