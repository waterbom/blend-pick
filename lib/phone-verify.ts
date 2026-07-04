import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const SECRET_STR = process.env.JWT_SECRET || "blend-pick-secret-key";
const SECRET = new TextEncoder().encode(SECRET_STR);

export function normPhone(phone: string) {
  return (phone || "").replace(/[^0-9]/g, "");
}

// 인증번호는 평문 저장 금지 — 해시만 토큰에 담는다
function hashCode(phone: string, code: string) {
  return crypto.createHash("sha256").update(`${normPhone(phone)}:${code}:${SECRET_STR}`).digest("hex");
}

// 발송 시: 번호+코드해시를 3분짜리 토큰으로 (phone_verify 쿠키)
export async function signChallenge(phone: string, code: string) {
  return new SignJWT({ phone: normPhone(phone), h: hashCode(phone, code) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("3m")
    .sign(SECRET);
}

export async function verifyChallenge(token: string, phone: string, code: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.phone === normPhone(phone) && payload.h === hashCode(phone, code);
  } catch {
    return false;
  }
}

// 인증 완료 시: 30분짜리 인증완료 토큰 (phone_verified 쿠키)
export async function signVerified(phone: string) {
  return new SignJWT({ phone: normPhone(phone), v: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30m")
    .sign(SECRET);
}

export async function isPhoneVerified(token: string | undefined, phone: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.v === true && payload.phone === normPhone(phone);
  } catch {
    return false;
  }
}
