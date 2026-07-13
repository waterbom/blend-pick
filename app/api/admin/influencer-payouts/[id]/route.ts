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

// 지급완료 / 지급취소
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();
  if (status !== "paid" && status !== "pending") {
    return NextResponse.json({ error: "status는 paid 또는 pending" }, { status: 400 });
  }

  const r = await shopPool.query(
    `UPDATE influencer_payouts
     SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE NULL END, updated_at = NOW()
     WHERE id = $2`,
    [status, id]
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
