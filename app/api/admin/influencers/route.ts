import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import { COUNTABLE_ORDER_STATUSES } from "@/lib/settlement";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 인플루언서 목록 + 누적 판매 집계 (OS/Shop 크로스 DB — JS에서 병합)
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const params: string[] = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = "WHERE i.name ILIKE $1";
  }

  const [influencers, stats] = await Promise.all([
    pool.query(
      `SELECT i.id, i.name, i.platform, i.profile_image, i.phone, i.followers_count,
              i.category, i.business_type, i.memo, i.user_id,
              u.email AS account_email,
              (SELECT COUNT(*) FROM campaigns c WHERE c.influencer_id = i.id AND c.is_archived = false) AS campaign_count
       FROM influencers i
       LEFT JOIN shop_users u ON u.id = i.user_id
       ${where}
       ORDER BY i.name ASC`,
      params
    ),
    shopPool.query(
      `SELECT influencer_id,
              COUNT(*) AS order_count,
              COALESCE(SUM(total_amount - shipping_fee), 0) AS gross_sales
       FROM orders
       WHERE influencer_id IS NOT NULL AND status = ANY($1)
       GROUP BY influencer_id`,
      [[...COUNTABLE_ORDER_STATUSES]]
    ),
  ]);

  const statMap = new Map(stats.rows.map((r) => [r.influencer_id, r]));
  const rows = influencers.rows.map((i) => ({
    ...i,
    order_count: Number(statMap.get(i.id)?.order_count ?? 0),
    gross_sales: Number(statMap.get(i.id)?.gross_sales ?? 0),
  }));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: "이름은 필수입니다" }, { status: 400 });

  const { rows } = await pool.query(
    `INSERT INTO influencers (
       name, platform, profile_image, phone, followers_count, category,
       business_type, bank_name, bank_account, bank_holder, tax_email, memo,
       id_card_file, biz_cert_file, bankbook_file
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      b.name, b.platform || null, b.profile_image || null, b.phone || null,
      b.followers_count ?? null, b.category || null,
      b.business_type || null, b.bank_name || null, b.bank_account || null,
      b.bank_holder || null, b.tax_email || null, b.memo || null,
      b.id_card_file || null, b.biz_cert_file || null, b.bankbook_file || null,
    ]
  );
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
