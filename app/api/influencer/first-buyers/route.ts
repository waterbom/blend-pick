import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import { COUNTABLE_ORDER_STATUSES } from "@/lib/settlement";

// 인플루언서 본인 인증 (shop_token role=influencer + influencers 연결 확인)
async function getInfluencer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const { rows } = await pool.query(
    `SELECT i.id FROM influencers i
     JOIN shop_users u ON u.id = i.user_id::text
     WHERE u.id = $1 AND u.role = 'influencer'`,
    [payload.id]
  );
  return rows[0] ?? null;
}

// 선착순 구매자 명단 — 내 링크로 결제된 유효 주문만, 전화번호 중복 제거(가장 빠른 유효 결제 인정)
// 취소/환불은 상태 필터로 제외되므로 "첫 주문이 취소되면 다음 유효 결제로 재계산"이 자동 성립
export async function GET(req: Request) {
  const inf = await getInfluencer();
  if (!inf) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id 필요" }, { status: 400 });

  const { rows } = await shopPool.query(
    `SELECT o.buyer_name, o.buyer_phone,
            to_char(COALESCE(o.paid_at, o.created_at) AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS paid_label,
            COALESCE(o.paid_at, o.created_at) AS paid_at
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.order_type = 'shop'
       AND o.influencer_id = $1
       AND oi.product_id = $2
       AND o.status = ANY($3)
     ORDER BY COALESCE(o.paid_at, o.created_at) ASC`,
    [inf.id, productId, [...COUNTABLE_ORDER_STATUSES]]
  );

  // 전화번호(숫자만) 기준 중복 제거 — 정렬이 결제시간 오름차순이라 첫 등장 = 가장 빠른 유효 결제
  const seen = new Set<string>();
  const buyers: { name: string; phone: string; paid_label: string }[] = [];
  for (const r of rows) {
    const key = String(r.buyer_phone || "").replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    buyers.push({ name: r.buyer_name, phone: r.buyer_phone, paid_label: r.paid_label });
  }

  return NextResponse.json({ buyers });
}
