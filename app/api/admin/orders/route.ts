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

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";

  const where = status ? `WHERE o.status = $1` : "";
  const params = status ? [status] : [];

  const result = await shopPool.query(`
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.order_type,
      o.buyer_name,
      o.buyer_phone,
      o.recipient_name,
      o.recipient_phone,
      o.addr_zipcode,
      o.addr_address,
      o.addr_detail,
      o.addr_memo,
      o.total_amount,
      o.shipping_fee,
      o.tracking_company,
      o.tracking_number,
      o.created_at,
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_code', ps.product_code,
          'option_label', oi.option_label,
          'unit_price', oi.unit_price,
          'quantity', oi.quantity
        ) ORDER BY oi.id
      ) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products_shop ps ON ps.id = oi.product_id
    ${where}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 500
  `, params);

  return NextResponse.json(result.rows);
}

// 일괄 상태 변경
// action: "confirm" | "dispatch" | "exchange_complete" | "return_complete" | "cancel_confirm"
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderIds, action } = await req.json();
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "주문 ID가 없습니다" }, { status: 400 });
  }

  const TRANSITIONS: Record<string, { from: string; to: string }> = {
    confirm:          { from: "paid",              to: "confirmed" },
    dispatch:         { from: "confirmed",          to: "preparing" },
    exchange_complete: { from: "exchange_requested", to: "exchange_completed" },
    return_complete:  { from: "return_requested",   to: "return_completed" },
    cancel_confirm:   { from: "cancel_requested",   to: "cancelled" },
  };

  const t = TRANSITIONS[action];
  if (!t) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const result = await shopPool.query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = ANY($2::uuid[]) AND status = $3`,
    [t.to, orderIds, t.from]
  );

  return NextResponse.json({ ok: true, updated: result.rowCount });
}
