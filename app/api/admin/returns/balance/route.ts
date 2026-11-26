import { withApiErrors } from '@/lib/api-errors';
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { returnPaymentBalance } from "@/lib/return-payment";
import shopPool from "@/lib/db-shop";

// 반품 환불 전 토스 취소 가능 잔액 조회 — 환불 입력창에 잔액·기존 취소 내역을 보여주기 위함
async function handleGET(req: Request) {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token || !(await verifyAdminToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = (await currentAdminSite()).key;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });

  const { rows } = await shopPool.query(
    `SELECT o.payment_key, o.total_amount
       FROM order_returns r JOIN orders o ON o.id = r.order_id
      WHERE r.id = $1 AND o.site = $2`,
    [id, site]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  // 테스트 결제·결제키 없음 — 조회할 잔액이 없으니 결제액 그대로
  if (!row.payment_key || String(row.payment_key).startsWith("SIM_")) {
    return NextResponse.json({ balance: Number(row.total_amount), canceled: 0, cancels: [] });
  }

  return NextResponse.json(await returnPaymentBalance(row.payment_key, Number(row.total_amount)));
}

export const GET = withApiErrors('GET /api/admin/returns/balance', handleGET);
