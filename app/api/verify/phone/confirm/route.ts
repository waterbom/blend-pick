import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyChallenge, signVerified } from "@/lib/phone-verify";

// 인증번호 확인
export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();
  const token = (await cookies()).get("phone_verify")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "인증번호가 만료되었어요. 다시 요청해주세요." }, { status: 400 });
  }
  if (!(await verifyChallenge(token, phone || "", String(code || "").trim()))) {
    return NextResponse.json({ ok: false, error: "인증번호가 올바르지 않아요." }, { status: 400 });
  }

  const verified = await signVerified(phone);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("phone_verified", verified, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1800,
    path: "/",
  });
  // 챌린지 소비
  res.cookies.set("phone_verify", "", { maxAge: 0, path: "/" });
  return res;
}
