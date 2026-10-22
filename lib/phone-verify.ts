import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const DEFAULT_SECRET = "blend-pick-secret-key";

function secretString() {
  const value = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value === DEFAULT_SECRET)) {
    throw new Error("JWT_SECRET must be configured with a private value");
  }
  return value || DEFAULT_SECRET;
}

function secretBytes() {
  return new TextEncoder().encode(secretString());
}

export function normPhone(phone: unknown) {
  return typeof phone === 'string' ? phone.replace(/[^0-9]/g, "") : '';
}

// 인증번호는 평문 저장 금지 — 번호+코드는 서버 비밀키 HMAC으로만 토큰에 담는다.
function hashCode(phone: string, code: string) {
  return crypto.createHmac("sha256", secretString()).update(`${normPhone(phone)}:${code}`).digest("hex");
}

export async function signChallenge(phone: string, code: string) {
  return new SignJWT({ phone: normPhone(phone), h: hashCode(phone, code) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("3m")
    .sign(secretBytes());
}

export async function verifyChallenge(token: string, phone: string, code: string) {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ["HS256"] });
    return payload.phone === normPhone(phone) && payload.h === hashCode(phone, code);
  } catch {
    return false;
  }
}

export async function signVerified(phone: string) {
  return new SignJWT({ phone: normPhone(phone), v: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(secretBytes());
}

export async function isPhoneVerified(token: string | undefined, phone: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ["HS256"] });
    return payload.v === true && payload.phone === normPhone(phone);
  } catch {
    return false;
  }
}

export async function verifiedPhoneOf(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretBytes(), { algorithms: ["HS256"] });
    return payload.v === true && typeof payload.phone === "string" ? payload.phone : null;
  } catch {
    return null;
  }
}
