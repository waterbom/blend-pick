import { NextRequest, NextResponse } from "next/server";
import { sendSMS, phoneVerifyOn } from "@/lib/sms";
import { signChallenge, normPhone } from "@/lib/phone-verify";

// 인증번호 발송
export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  const p = normPhone(phone);
  if (p.length < 10) {
    return NextResponse.json({ ok: false, error: "올바른 휴대폰 번호를 입력해주세요." }, { status: 400 });
  }
  if (!phoneVerifyOn()) {
    return NextResponse.json({ ok: false, error: "문자 인증이 현재 비활성화되어 있어요." }, { status: 400 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const sms = await sendSMS(p, `[블랜드픽] 인증번호 [${code}] 를 입력해주세요.`);
  if (!sms.ok) {
    // SOLAPI 실제 실패 사유를 서버 로그에 남김 (journalctl 로 확인)
    console.error("[verify/phone] SMS 발송 실패:", sms.error);
    return NextResponse.json(
      { ok: false, error: sms.error === "NOT_CONFIGURED" ? "문자 인증이 아직 설정되지 않았어요." : "문자 발송에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  const token = await signChallenge(p, code);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("phone_verify", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 180,
    path: "/",
  });
  return res;
}
