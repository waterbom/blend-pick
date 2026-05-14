import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

// 토스페이먼츠 수수료율
const FEE_RATE: Record<string, number> = {
  card: 0.0363,      // 카드 3.63% (3.3% + VAT)
  transfer: 0.0165,  // 계좌이체 1.65% (1.5% + VAT)
};

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// PATCH /api/admin/orders/[id] — 주문 상태 변경
// body: { status: "preparing" | "shipped" | "delivered" | "cancelled" }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status, tracking_company, tracking_number } = await request.json();

  const VALID = ["preparing", "shipped", "delivered", "cancelled"];
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // 주문 상태 변경 (운송장 정보 있으면 함께 저장)
    const { rows } = await client.query(
      `UPDATE orders
       SET status = $1,
           tracking_company = COALESCE($3, tracking_company),
           tracking_number  = COALESCE($4, tracking_number)
       WHERE id = $2
       RETURNING id, order_number, total_amount, payment_method, payment_key`,
      [status, id, tracking_company ?? null, tracking_number ?? null]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];

    // 배송완료 → 정산 레코드 자동 생성
    if (status === "delivered") {
      // 이미 정산 레코드가 있으면 중복 생성 방지
      const existing = await client.query(
        `SELECT id FROM settlements WHERE order_id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        const method = order.payment_method || "card";
        const rate = FEE_RATE[method] ?? FEE_RATE["card"];
        const gross = Number(order.total_amount);
        const fee = Math.round(gross * rate);
        const net = gross - fee;

        await client.query(
          `INSERT INTO settlements (payment_key, order_id, gross_amount, fee, net_amount, settled_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [order.payment_key || `manual_${order.order_number}`, id, gross, fee, net]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("주문 상태 변경 실패:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
