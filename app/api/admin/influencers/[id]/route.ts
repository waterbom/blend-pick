import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [inf, campaigns] = await Promise.all([
    pool.query(
      `SELECT i.*, u.email AS account_email
       FROM influencers i LEFT JOIN shop_users u ON u.id = i.user_id::text
       WHERE i.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT c.id, c.start_date, c.end_date, c.commission_rate, c.supply_price,
              c.is_archived, p.name AS product_name
       FROM campaigns c JOIN products p ON p.id = c.product_id
       WHERE c.influencer_id = $1
       ORDER BY c.end_date DESC`,
      [id]
    ),
  ]);
  if (!inf.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...inf.rows[0], campaigns: campaigns.rows });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: "이름은 필수입니다" }, { status: 400 });

  const r = await pool.query(
    `UPDATE influencers SET
       name = $1, platform = $2, profile_image = $3, phone = $4,
       updated_at = NOW(),
       followers_count = $5, category = $6, business_type = $7,
       bank_name = $8, bank_account = $9, bank_holder = $10,
       tax_email = $11, memo = $12,
       id_card_file = $13, biz_cert_file = $14, bankbook_file = $15
     WHERE id = $16`,
    [
      b.name, b.platform || "", b.profile_image || null, b.phone || null,
      b.followers_count ?? null, b.category || null, b.business_type || null,
      b.bank_name || null, b.bank_account || null, b.bank_holder || null,
      b.tax_email || null, b.memo || null,
      b.id_card_file || null, b.biz_cert_file || null, b.bankbook_file || null,
      id,
    ]
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // 공구 이력이 있으면 삭제 금지 (정산 기록 보존)
  const ref = await pool.query("SELECT COUNT(*) AS n FROM campaigns WHERE influencer_id = $1", [id]);
  if (Number(ref.rows[0].n) > 0) {
    return NextResponse.json(
      { error: "진행한 공구가 있는 인플루언서는 삭제할 수 없습니다" },
      { status: 409 }
    );
  }
  await pool.query("DELETE FROM influencers WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
