import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { SignJWT } from "jose";

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || "blend-admin-secret-2026"
);

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // 관리자 계정이면 admin_users 테이블에서 처리
  if (email === "admin@blendpick.com") {
    const adminResult = await shopPool.query(
      "SELECT * FROM admin_users WHERE email = $1",
      [email]
    );
    const admin = adminResult.rows[0];
    if (!admin) {
      return NextResponse.json({ ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    const adminToken = await new SignJWT({ id: admin.id, email: admin.email, name: admin.name })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(ADMIN_SECRET);

    const res = NextResponse.json({ ok: true, redirect: "/" });
    res.cookies.set("admin_token", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    return res;
  }

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

  // 인플루언서 계정은 로그인 후 인플루언서 탭으로
  const res = NextResponse.json({
    ok: true,
    role: user.role,
    redirect: user.role === "influencer" ? "/influencer" : undefined,
  });
  res.cookies.set("shop_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return res;
}
