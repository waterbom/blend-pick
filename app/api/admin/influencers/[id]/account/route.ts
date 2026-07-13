import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomUUID, randomInt } from "crypto";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 헷갈리는 문자(0/O, 1/l/I) 제외
const LETTERS = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const PW_CHARS = LETTERS + LETTERS.toUpperCase() + DIGITS;

function genLoginId() {
  let s = "";
  for (let i = 0; i < 5; i++) s += LETTERS[randomInt(LETTERS.length)];
  for (let i = 0; i < 3; i++) s += DIGITS[randomInt(DIGITS.length)];
  return s;
}

function genPassword() {
  let s = "";
  for (let i = 0; i < 10; i++) s += PW_CHARS[randomInt(PW_CHARS.length)];
  return s;
}

// 포털 계정 발급 — 버튼 한 번으로 아이디/비밀번호 자동 생성
// 비밀번호는 해시로만 저장되므로 응답에 담긴 값을 이때 복사해서 전달해야 함
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

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
      return NextResponse.json({ error: "이미 계정이 발급되어 있습니다. 비밀번호 재설정을 사용하세요." }, { status: 409 });
    }

    // 아이디 중복 방지 (최대 5회 재시도)
    let loginId = "";
    for (let i = 0; i < 5; i++) {
      const candidate = genLoginId();
      const dup = await client.query("SELECT 1 FROM shop_users WHERE email = $1", [candidate]);
      if (!dup.rows[0]) { loginId = candidate; break; }
    }
    if (!loginId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "아이디 생성 실패, 다시 시도해주세요" }, { status: 500 });
    }

    const password = genPassword();
    const userId = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO shop_users (id, name, email, password_hash, role, role_status, is_active, is_verified)
       VALUES ($1, $2, $3, $4, 'influencer', 'approved', true, true)`,
      [userId, inf.rows[0].name, loginId, hash]
    );
    await client.query("UPDATE influencers SET user_id = $1, portal_password = $2 WHERE id = $3", [userId, password, id]);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, login_id: loginId, password }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[influencer account]", e);
    return NextResponse.json({ error: "계정 발급 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}

// 비밀번호 재설정 — 새 비밀번호 자동 생성 후 반환
export async function PUT(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const inf = await pool.query(
    `SELECT i.user_id, u.email FROM influencers i
     LEFT JOIN shop_users u ON u.id = i.user_id::text
     WHERE i.id = $1`,
    [id]
  );
  if (!inf.rows[0]?.user_id) {
    return NextResponse.json({ error: "발급된 계정이 없습니다" }, { status: 404 });
  }

  const password = genPassword();
  const hash = await bcrypt.hash(password, 10);
  await pool.query("UPDATE shop_users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    hash,
    inf.rows[0].user_id,
  ]);
  await pool.query("UPDATE influencers SET portal_password = $1 WHERE id = $2", [password, id]);
  return NextResponse.json({ ok: true, login_id: inf.rows[0].email, password });
}
