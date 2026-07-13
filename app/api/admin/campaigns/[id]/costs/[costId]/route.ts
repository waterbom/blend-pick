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

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; costId: string }> }
) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, costId } = await params;
  await shopPool.query("DELETE FROM campaign_costs WHERE id = $1 AND campaign_id = $2", [costId, id]);
  return NextResponse.json({ ok: true });
}
