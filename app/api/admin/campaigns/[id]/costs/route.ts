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

const CATEGORIES = new Set(["shipping", "ad", "sample", "etc"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { category, amount, memo } = await req.json();
  if (!CATEGORIES.has(category) || !Number.isFinite(Number(amount))) {
    return NextResponse.json({ error: "카테고리/금액이 올바르지 않습니다" }, { status: 400 });
  }

  const { rows } = await shopPool.query(
    `INSERT INTO campaign_costs (campaign_id, category, amount, memo)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [id, category, Math.round(Number(amount)), memo || null]
  );
  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
