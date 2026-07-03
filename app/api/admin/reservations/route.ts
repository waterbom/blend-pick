import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") || "";
  const where = status
    ? `WHERE o.order_type = 'hotel' AND o.status = $1`
    : `WHERE o.order_type = 'hotel'`;
  const params = status ? [status] : [];

  const result = await shopPool.query(
    `SELECT
       o.id, o.order_number, o.status,
       o.buyer_name, o.buyer_phone,
       o.addr_memo,
       to_char(o.stay_check_in, 'YYYY-MM-DD') AS stay_check_in,
       to_char(o.stay_check_out, 'YYYY-MM-DD') AS stay_check_out,
       o.total_amount, o.created_at,
       (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
     FROM orders o
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 500`,
    params
  );

  return NextResponse.json(result.rows);
}

// 예약 상태 변경
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  const allowed = ["paid", "checked_in", "cancelled", "no_show"];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const r = await shopPool.query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND order_type = 'hotel'`,
    [status, id]
  );
  return NextResponse.json({ ok: true, updated: r.rowCount });
}
