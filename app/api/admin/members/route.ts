import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import { COUNTABLE_ORDER_STATUSES } from "@/lib/settlement";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 회원 관리 — 회원(OS DB) + 주문 집계(Shop DB)를 합쳐서 내려준다.
// 가입일(created_at)이 없는 기존 회원은 첫 주문일을 대체 표시.
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim();
  const role = sp.get("role") || "";
  const status = sp.get("status") || ""; // active | inactive
  const pending = sp.get("pending") === "1"; // 심사 중만

  const conds: string[] = ["1=1"];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conds.push(`(name ILIKE $${params.length} OR nickname ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (role) { params.push(role); conds.push(`role = $${params.length}`); }
  if (status === "active") conds.push(`is_active IS NOT FALSE`);
  if (status === "inactive") conds.push(`is_active = FALSE`);
  if (pending) conds.push(`role_status = 'pending'`);

  const users = await pool.query(
    `SELECT id, name, nickname, email, role, role_status, is_active, profile_image,
            kakao_id IS NOT NULL AS via_kakao,
            to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS joined_at
       FROM shop_users
      WHERE ${conds.join(" AND ")}
      ORDER BY created_at DESC NULLS LAST, id
      LIMIT 500`,
    params
  );

  // Shop DB 집계 — 주문수·누적 구매액(유효 상태만)·최근/첫 주문일·취소/교환반품 횟수
  const ids = users.rows.map((u) => String(u.id));
  const aggMap = new Map<string, Record<string, unknown>>();
  if (ids.length) {
    const agg = await shopPool.query(
      `SELECT o.user_id,
              COUNT(*) FILTER (WHERE o.status = ANY($2)) AS orders,
              COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = ANY($2)), 0) AS spent,
              COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancels,
              to_char(MAX(o.paid_at) AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS last_order_at,
              to_char(MIN(o.paid_at) AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS first_order_at
         FROM orders o
        WHERE o.user_id = ANY($1)
        GROUP BY o.user_id`,
      [ids, [...COUNTABLE_ORDER_STATUSES]]
    );
    for (const r of agg.rows) aggMap.set(String(r.user_id), r);
    const rets = await shopPool.query(
      `SELECT o.user_id, COUNT(*) AS returns
         FROM order_returns r JOIN orders o ON o.id = r.order_id
        WHERE o.user_id = ANY($1)
        GROUP BY o.user_id`,
      [ids]
    );
    for (const r of rets.rows) {
      const cur = aggMap.get(String(r.user_id)) ?? {};
      aggMap.set(String(r.user_id), { ...cur, returns: r.returns });
    }
  }

  const members = users.rows.map((u) => {
    const a = aggMap.get(String(u.id)) ?? {};
    return {
      ...u,
      orders: Number(a.orders ?? 0),
      spent: Number(a.spent ?? 0),
      cancels: Number(a.cancels ?? 0),
      returns: Number(a.returns ?? 0),
      last_order_at: a.last_order_at ?? null,
      joined_at: u.joined_at ?? a.first_order_at ?? null, // 가입일 미상이면 첫 주문일
      joined_estimated: !u.joined_at && !!a.first_order_at,
    };
  });

  // 요약 카드 (필터와 무관한 전체 기준)
  const [totals, buyers] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Seoul'))::int AS new_month,
              COUNT(*) FILTER (WHERE role = 'influencer')::int AS influencers,
              COUNT(*) FILTER (WHERE role_status = 'pending')::int AS pending
         FROM shop_users`
    ),
    shopPool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS n FROM orders
        WHERE user_id IS NOT NULL AND paid_at >= NOW() - INTERVAL '30 days' AND status = ANY($1)`,
      [[...COUNTABLE_ORDER_STATUSES]]
    ),
  ]);

  return NextResponse.json({
    members,
    summary: { ...totals.rows[0], buyers30: buyers.rows[0]?.n ?? 0 },
  });
}

// PATCH { id, action: 'activate' | 'deactivate' | 'approve' | 'reject' | 'set_role', role? }
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, role } = await req.json();
  if (!id) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  if (action === "activate" || action === "deactivate") {
    const r = await pool.query(`UPDATE shop_users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
      [action === "activate", id]);
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }
  if (action === "approve" || action === "reject") {
    const r = await pool.query(
      `UPDATE shop_users SET role_status = $1, updated_at = NOW() WHERE id = $2 AND role_status = 'pending'`,
      [action === "approve" ? "approved" : "rejected", id]);
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }
  if (action === "set_role" && ["customer", "influencer", "vendor"].includes(role)) {
    const r = await pool.query(
      `UPDATE shop_users SET role = $1, role_status = CASE WHEN $1 = 'customer' THEN NULL ELSE 'approved' END,
              updated_at = NOW() WHERE id = $2`,
      [role, id]);
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }
  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
