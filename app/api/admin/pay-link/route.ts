import { SITES } from "@/lib/sites";
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { signPayLink } from "@/lib/pay-link";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 결제 링크 생성 (관리자 전용)
// 사용: /api/admin/pay-link?amount=90000&label=숙박 요금 차액
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { searchParams } = new URL(req.url);
  const amount = Number(searchParams.get("amount"));
  const label = (searchParams.get("label") || "추가 결제").trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount(금액)를 정확히 지정해주세요." }, { status: 400 });
  }

  const token = await signPayLink(amount, label, site);
  const link = `https://${SITES[site].host}/pay/extra?t=${token}`;
  return NextResponse.json({ amount, label, link });
}
