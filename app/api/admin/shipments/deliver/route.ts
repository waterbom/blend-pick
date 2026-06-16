import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

const FEE_RATE: Record<string, number> = {
  card: 0.0363,
  transfer: 0.0165,
};

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// PATCH /api/admin/shipments/deliver
// body: { orderIds: string[] }
// → 배송완료 일괄 처리 + 정산 레코드 자동 생성
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderIds } = await req.json();
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "주문 ID가 없습니다" }, { status: 400 });
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orders } = await client.query(
      `UPDATE orders SET status = 'delivered'
       WHERE id = ANY($1::uuid[]) AND status = 'shipped'
       RETURNING id, order_number, total_amount, payment_method, payment_key`,
      [orderIds]
    );

    for (const order of orders) {
      const existing = await client.query(
        `SELECT id FROM settlements WHERE order_id = $1`,
        [order.id]
      );
      if (existing.rows.length > 0) continue;

      const method = order.payment_method || "card";
      const rate = FEE_RATE[method] ?? FEE_RATE["card"];
      const gross = Number(order.total_amount);
      const fee = Math.round(gross * rate);
      const net = gross - fee;

      await client.query(
        `INSERT INTO settlements (payment_key, order_id, gross_amount, fee, net_amount, settled_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [order.payment_key || `manual_${order.order_number}`, order.id, gross, fee, net]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, updated: orders.length });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("배송완료 일괄 처리 실패:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
