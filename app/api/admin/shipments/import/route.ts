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

// POST /api/admin/shipments/import
// body: { rows: Array<{ order_number: string; carrier: string; tracking_number: string }> }
// → 주문 상태를 shipped로 변경 + 운송장 정보 저장
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await req.json() as {
    rows: { order_number: string; carrier: string; tracking_number: string }[];
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "데이터가 없습니다" }, { status: 400 });
  }

  const results: { order_number: string; success: boolean; reason?: string }[] = [];

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const { order_number, carrier, tracking_number } = row;
      if (!order_number || !tracking_number) {
        results.push({ order_number: order_number ?? "", success: false, reason: "주문번호 또는 운송장번호 누락" });
        continue;
      }

      const { rowCount } = await client.query(
        `UPDATE orders
         SET status = 'shipped',
             tracking_company = $2,
             tracking_number  = $3
         WHERE order_number = $1
           AND status = 'preparing'`,
        [order_number, carrier || null, tracking_number]
      );

      if ((rowCount ?? 0) === 0) {
        // 이미 shipped이거나 없는 주문
        const existing = await client.query(
          `SELECT status FROM orders WHERE order_number = $1`,
          [order_number]
        );
        if (existing.rows.length === 0) {
          results.push({ order_number, success: false, reason: "주문 없음" });
        } else {
          // 이미 처리된 주문은 운송장 정보만 업데이트
          await client.query(
            `UPDATE orders SET tracking_company = $2, tracking_number = $3 WHERE order_number = $1`,
            [order_number, carrier || null, tracking_number]
          );
          results.push({ order_number, success: true });
        }
      } else {
        results.push({ order_number, success: true });
      }
    }

    await client.query("COMMIT");

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);
    return NextResponse.json({ ok: true, succeeded, failed });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("운송장 임포트 실패:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
