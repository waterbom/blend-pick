import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { id } = await params;
  const [campaign, costs] = await Promise.all([
    pool.query(
      `SELECT c.id, c.start_date, c.end_date, c.commission_rate, c.supply_price, c.is_archived,
              p.name AS product_name, i.name AS influencer_name, i.business_type
       FROM campaigns c
       JOIN products p ON p.id = c.product_id
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.id = $1`,
      [id]
    ),
    shopPool.query(
      `SELECT id, category, amount, memo, created_at
       FROM campaign_costs WHERE campaign_id = $1 AND site = $2 ORDER BY created_at ASC`,
      [id, site]
    ),
  ]);
  if (!campaign.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...campaign.rows[0], costs: costs.rows });
}

// 요율/공급가 설정 (과거 주문 스냅샷에는 영향 없음 — 이후 주문부터 적용)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { commission_rate, supply_price } = await req.json();

  if (commission_rate != null && (commission_rate < 0 || commission_rate > 100)) {
    return NextResponse.json({ error: "수수료율은 0~100 사이여야 합니다" }, { status: 400 });
  }

  const r = await pool.query(
    "UPDATE campaigns SET commission_rate = $1, supply_price = $2 WHERE id = $3",
    [commission_rate ?? null, supply_price ?? null, id]
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
