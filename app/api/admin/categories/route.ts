import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

async function ensureTable() {
  await shopPool.query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();
  const result = await shopPool.query(
    `SELECT id, name, sort_order FROM product_categories ORDER BY sort_order ASC, created_at ASC`
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });

  try {
    const result = await shopPool.query(
      `INSERT INTO product_categories (name) VALUES ($1) RETURNING id, name`,
      [name.trim()]
    );
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "이미 존재하는 카테고리예요" }, { status: 409 });
  }
}
