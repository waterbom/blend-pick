import { NextRequest } from "next/server";
import shopPool from "@/lib/db-shop";
import { siteFromHost } from "@/lib/sites";
import { verifyToken } from "@/lib/auth";
import { KAKAO_FLOW_COOKIE, loginHash, loginFailure, loginResponse } from "@/lib/kakao-login";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.cookies.get(KAKAO_FLOW_COOKIE)?.value;
  if (!code || !state) return loginFailure(req, "expired_login");
  const result = await shopPool.query(
    `DELETE FROM oauth_login_handoffs WHERE code_hash = $1 AND state_hash = $2 AND site = $3 AND expires_at > NOW()
     RETURNING site, return_path, session_token`,
    [loginHash(code), loginHash(state), siteFromHost(req.headers.get("host"))]
  );
  const handoff = result.rows[0];
  if (!handoff || !await verifyToken(handoff.session_token)) return loginFailure(req, "expired_login");
  return loginResponse(req, handoff, handoff.session_token);
}
