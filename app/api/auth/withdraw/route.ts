import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "인증 정보가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  await pool.query("DELETE FROM shop_users WHERE id = $1", [payload.id]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("shop_token", "", { maxAge: 0, path: "/" });

  return res;
}
