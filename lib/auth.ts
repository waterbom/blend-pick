import { SignJWT, jwtVerify } from "jose";

const DEFAULT_USER_SECRET = "blend-pick-secret-key";

function userSecret() {
  const value = process.env.JWT_SECRET;
  // 개발·격리 테스트는 기존 기본값을 허용하지만 운영에서는 공개 기본키를 절대 사용하지 않는다.
  if (process.env.NODE_ENV === "production" && (!value || value === DEFAULT_USER_SECRET || value.length < 32)) {
    throw new Error("JWT_SECRET must be configured with at least 32 private characters");
  }
  return new TextEncoder().encode(value || DEFAULT_USER_SECRET);
}

export type TokenPayload = {
  id: string;
  kakao_id?: string;
  email?: string;
  nickname?: string;
  role: string;
};

export async function signToken(payload: TokenPayload, expiresIn = "7d") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(userSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, userSecret(), { algorithms: ["HS256"] });
    if (typeof payload.id !== "string" || !payload.id || typeof payload.role !== "string") return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// 관리자 권한은 일반 회원 role과 분리하며 이 계정만 허용한다.
export const ADMIN_EMAIL = "admin@blendpick.com";
type AdminPayload = { id: string; email: string; name: string };

function adminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  // 공개된 기본 키로 관리자 토큰을 발급하거나 검증하지 않는다.
  if (!secret || secret === "blend-admin-secret-2026") return null;
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(payload: AdminPayload): Promise<string | null> {
  const secret = adminSecret();
  if (!secret || payload.email !== ADMIN_EMAIL) return null;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  const secret = adminSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.email !== ADMIN_EMAIL || typeof payload.id !== "string" || !payload.id
        || typeof payload.name !== "string" || typeof payload.exp !== "number") return null;
    return { id: payload.id, email: ADMIN_EMAIL, name: payload.name };
  } catch {
    return null;
  }
}
