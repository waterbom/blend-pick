import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 회원 상세 — 최근 주문 10건 + 리뷰 수 (목록 행을 펼칠 때 로드)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [orders, reviews] = await Promise.all([
    shopPool.query(
      `SELECT o.order_number, o.status, o.order_type, o.total_amount,
              to_char(o.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS paid_date,
              (SELECT oi.product_name FROM order_items oi
                WHERE oi.order_id = o.id ORDER BY (oi.product_id IS NULL), oi.id LIMIT 1) AS product_name,
              (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o
        WHERE o.user_id = $1
        ORDER BY o.paid_at DESC NULLS LAST
        LIMIT 10`,
      [id]
    ),
    // reviews엔 user_id가 없어 주문 경유로 집계
    shopPool.query(
      `SELECT COUNT(*)::int AS n FROM reviews rv JOIN orders o ON o.id = rv.order_id WHERE o.user_id = $1`,
      [id]
    ).catch(() => ({ rows: [{ n: 0 }] })),
  ]);

  return NextResponse.json({ orders: orders.rows, reviewCount: reviews.rows[0]?.n ?? 0 });
}
