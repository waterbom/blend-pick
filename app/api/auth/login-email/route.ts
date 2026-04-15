import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const result = await pool.query(
    "SELECT id, role, name, password_hash, is_verified FROM shop_users WHERE email = $1",
    [email]
  );

  if (!result.rows.length) {
    return NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const user = result.rows[0];

  if (!user.is_verified) {
    return NextResponse.json(
      { ok: false, error: "이메일 인증이 필요합니다." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

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
