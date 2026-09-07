import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { currentAdminSite } from "@/lib/admin-site";
import { SITES } from "@/lib/sites";

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
  // 산지픽 어드민: 산지픽 카테고리만 (없으면 만들어 둔다) · Shop 어드민: 산지픽 카테고리 제외
  const site = (await currentAdminSite()).key;
  const sanjiCats = SITES.sanjipick.categories;
  if (site === "sanjipick") {
    for (const n of sanjiCats.filter((x) => x !== "산지픽")) { // 옛 이름 '산지픽'은 새로 만들지 않음
      await shopPool.query(`INSERT INTO product_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [n]);
    }
  }
  const result = await shopPool.query(
    site === "sanjipick"
      ? `SELECT id, name, sort_order FROM product_categories WHERE name = ANY($1::text[]) ORDER BY sort_order ASC, created_at ASC`
      : `SELECT id, name, sort_order FROM product_categories WHERE name <> ALL($1::text[]) ORDER BY sort_order ASC, created_at ASC`,
    [sanjiCats]
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
