import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "blend-pick-secret-key"
);

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
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
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
