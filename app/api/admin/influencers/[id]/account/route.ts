import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 인플루언서 포털 계정 발급 — shop_users(role='influencer') 생성 + influencers.user_id 링크
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { email, password } = await req.json();
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "이메일과 8자 이상 비밀번호가 필요합니다" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inf = await client.query("SELECT id, name, user_id FROM influencers WHERE id = $1", [id]);
    if (!inf.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "인플루언서 없음" }, { status: 404 });
    }
    if (inf.rows[0].user_id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "이미 계정이 발급되어 있습니다" }, { status: 409 });
    }
    const dup = await client.query("SELECT 1 FROM shop_users WHERE email = $1", [email]);
    if (dup.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다" }, { status: 409 });
    }

    const userId = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO shop_users (id, name, email, password_hash, role, role_status, is_active, is_verified)
       VALUES ($1, $2, $3, $4, 'influencer', 'approved', true, true)`,
      [userId, inf.rows[0].name, email, hash]
    );
    await client.query("UPDATE influencers SET user_id = $1 WHERE id = $2", [userId, id]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, email }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[influencer account]", e);
    return NextResponse.json({ error: "계정 발급 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}

// 비밀번호 재설정
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { password } = await req.json();
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "8자 이상 비밀번호가 필요합니다" }, { status: 400 });
  }

  const inf = await pool.query("SELECT user_id FROM influencers WHERE id = $1", [id]);
  if (!inf.rows[0]?.user_id) {
    return NextResponse.json({ error: "발급된 계정이 없습니다" }, { status: 404 });
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query("UPDATE shop_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    hash,
    inf.rows[0].user_id,
  ]);
  return NextResponse.json({ ok: true });
}
