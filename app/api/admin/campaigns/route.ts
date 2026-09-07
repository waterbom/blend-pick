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

// 공구 목록 + 기타비용 합계 (OS/Shop 크로스 DB — JS 병합)
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const [campaigns, costs] = await Promise.all([
    pool.query(
      `SELECT c.id, c.start_date, c.end_date, c.commission_rate, c.supply_price, c.is_archived,
              p.name AS product_name, i.name AS influencer_name
       FROM campaigns c
       JOIN products p ON p.id = c.product_id
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.shop_managed = true
       ORDER BY c.is_archived ASC, c.end_date DESC`
    ),
    shopPool.query(
      `SELECT campaign_id, COALESCE(SUM(amount), 0) AS total
       FROM campaign_costs WHERE site = $1 GROUP BY campaign_id`, [site]
    ),
  ]);

  const costMap = new Map(costs.rows.map((r) => [r.campaign_id, Number(r.total)]));
  return NextResponse.json(
    campaigns.rows.map((c) => ({ ...c, costs_total: costMap.get(c.id) ?? 0 }))
  );
}
