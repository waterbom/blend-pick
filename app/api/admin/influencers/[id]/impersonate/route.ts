import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, signToken } from "@/lib/auth";
import pool from "@/lib/db";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 관리자용 — 발급된 인플루언서 계정으로 바로 로그인 (비밀번호 없이 토큰 발급)
// admin_token으로만 호출 가능. shop_token을 해당 계정으로 교체하므로
// 브라우저에 다른 쇼핑몰 계정이 로그인돼 있었다면 그 세션은 이 계정으로 바뀜
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role
     FROM influencers i JOIN shop_users u ON u.id = i.user_id::text
     WHERE i.id = $1`,
    [id]
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "발급된 계정이 없어요. 먼저 계정을 발급해주세요." }, { status: 404 });
  if (user.role !== "influencer") return NextResponse.json({ error: "인플루언서 계정이 아닙니다." }, { status: 400 });

  // 대리 로그인은 2시간만 유효 — 관리자 확인용 세션이 브라우저에 오래 남지 않게
  const token = await signToken(
    {
      id: user.id,
      email: user.email ?? undefined,
      nickname: user.name || "",
      role: user.role,
    },
    "2h"
  );

  const res = NextResponse.json({ ok: true, redirect: "/influencer" });
  res.cookies.set("shop_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 2,
    path: "/",
  });
  return res;
}
