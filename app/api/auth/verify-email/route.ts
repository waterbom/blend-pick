import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  const result = await pool.query(
    "SELECT id, role, name, email_verify_code, email_verify_expires_at FROM shop_users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return NextResponse.json(
      { ok: false, error: "유저를 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  const user = result.rows[0];

  if (user.email_verify_code !== code) {
    return NextResponse.json(
      { ok: false, error: "인증 코드가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (new Date() > new Date(user.email_verify_expires_at)) {
    return NextResponse.json(
      { ok: false, error: "인증 코드가 만료되었습니다." },
      { status: 400 }
    );
  }

  // 인증 완료 처리
  await pool.query(
    "UPDATE shop_users SET is_verified = true, email_verify_code = NULL, email_verify_expires_at = NULL WHERE id = $1",
    [user.id]
  );

  // JWT 발급
  const token = await signToken({
    id: user.id,
    email,
    nickname: user.name || "",
    role: user.role,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("shop_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return res;
}
