import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { signToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { KAKAO_FLOW_COOKIE, loginHash, loginFailure, completeOrRelay } from "@/lib/kakao-login";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (!state || state !== req.cookies.get(KAKAO_FLOW_COOKIE)?.value) return loginFailure(req, "invalid_state");
  const result = await shopPool.query(
    "DELETE FROM oauth_login_flows WHERE state_hash = $1 AND expires_at > NOW() RETURNING site, return_path",
    [loginHash(state)]
  );
  const flow = result.rows[0];
  if (!flow) return loginFailure(req, "expired_login");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return loginFailure(req, "no_code", flow);
  try {
    // 1. 카카오에서 access_token 받기
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID!,
        redirect_uri: process.env.KAKAO_REDIRECT_URI!,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return loginFailure(req, "token_failed", flow);
    }

    // 2. 카카오에서 유저 정보 가져오기
    const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();

    if (!userRes.ok || !userData.id) return loginFailure(req, "profile_failed", flow);
    const kakaoId = String(userData.id);
    const nickname = userData.kakao_account?.profile?.nickname || null;
    const profileImage = userData.kakao_account?.profile?.profile_image_url || null;

    // 3. DB에서 기존 유저 확인 → 없으면 자동 가입
    const existing = await pool.query(
      "SELECT id, role, is_active FROM shop_users WHERE kakao_id = $1",
      [kakaoId]
    );
    // 관리자가 비활성화한 계정은 로그인 차단
    if (existing.rows.length > 0 && existing.rows[0].is_active === false) {
      return loginFailure(req, "inactive", flow);
    }

    let userId: string;
    let role: string;

    if (existing.rows.length > 0) {
      // 기존 유저 — access_token 업데이트
      userId = existing.rows[0].id;
      role = existing.rows[0].role;
      await pool.query(
        "UPDATE shop_users SET kakao_access_token = $1, updated_at = NOW() WHERE id = $2",
        [accessToken, userId]
      );
    } else {
      // 신규 유저 — 자동 가입
      userId = crypto.randomUUID();
      role = "customer";
      await pool.query(
        `INSERT INTO shop_users (id, kakao_id, kakao_access_token, nickname, profile_image, role, is_active, is_verified)
         VALUES ($1, $2, $3, $4, $5, 'customer', true, true)`,
        [userId, kakaoId, accessToken, nickname, profileImage]
      );
    }

    // 4. JWT 발급 → 쿠키 저장
    const token = await signToken({ id: userId, kakao_id: kakaoId, nickname: nickname || "", role });

    return await completeOrRelay(req, flow, token, state);
  } catch {
    return loginFailure(req, "login_failed", flow);
  }
}
