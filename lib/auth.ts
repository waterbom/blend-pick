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

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "blend-admin-secret-2026"
);

export async function verifyAdminToken(token: string): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_SECRET);
    return payload as { id: string; email: string; name: string };
  } catch {
    return null;
  }
}
