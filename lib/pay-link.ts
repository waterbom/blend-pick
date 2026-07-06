import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "blend-pick-secret-key");

// 결제 링크 토큰 — 금액을 서명해 담아 URL 조작(금액 변경) 방지
export async function signPayLink(amount: number, label: string) {
  return new SignJWT({ amount, label, purpose: "extra-pay" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("120d")
    .sign(SECRET);
}

export async function verifyPayLink(token: string): Promise<{ amount: number; label: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== "extra-pay") return null;
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount, label: String(payload.label || "추가 결제") };
  } catch {
    return null;
  }
}
