import { currentAdminSite, adminOrderIdsBelong } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelShopOrder } from "@/lib/order-cancel";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";

  // 호텔 예약(order_type='hotel')은 '예약 관리'에서 따로 관리 → 판매 관리에서 제외
  // 삭제된 상품만 담긴 주문은 목록에서 숨김(데이터는 보존 — 상품 삭제 시 order_items.product_id가 NULL이 됨).
  //  · 차액(extra) 주문은 원래 상품 연결이 없으므로 그대로 노출
  //  · 살아있는 상품이 하나라도 있는 주문은 노출
  const notDeletedProduct = `(
    o.order_type = 'extra'
    OR EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.product_id IS NOT NULL)
  )`;
  // status는 쉼표 목록 허용 (예: confirmed,preparing — 배송준비 탭에서 주문확인 건 포함)
  // 판매·배송 관리는 일반 상품(shop)·공동구매(campaign)만 — 호텔 예약과 호텔 차액(extra)은 예약 관리에서
  const conds = [site === 'sanjipick' ? `o.order_type IN ('shop', 'campaign', 'extra')` : `o.order_type IN ('shop', 'campaign')`, notDeletedProduct];
  const params: unknown[] = [];
  if (status) { params.push(status.split(",").map((v) => v.trim()).filter(Boolean)); conds.push(`o.status = ANY($${params.length})`); }
  if (site === "blendpick" || site === "sanjipick") { params.push(site); conds.push(`o.site = $${params.length}`); }
  const where = `WHERE ${conds.join(" AND ")}`;

  const result = await shopPool.query(`
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.order_type,
      o.site,
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
      o.influencer_name,
      o.created_at,
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'product_code', ps.product_code,
          'option_label', COALESCE(oi.option_label, po.value),
          'unit_price', oi.unit_price,
          'quantity', oi.quantity
        ) ORDER BY (oi.product_id IS NULL), oi.id
      ) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products_shop ps ON ps.id = oi.product_id
    LEFT JOIN product_options po ON po.id = oi.option_id
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
  const site = (await currentAdminSite()).key;

  const { orderIds, action, deduct_shipping } = await req.json();
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "주문 ID가 없습니다" }, { status: 400 });
  }

  if (!(await adminOrderIdsBelong(orderIds, site))) return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });

  const TRANSITIONS: Record<string, { from: string; to: string }> = {
    confirm:          { from: "paid",              to: "confirmed" },
    dispatch:         { from: "confirmed",          to: "preparing" },
    exchange_complete: { from: "exchange_requested", to: "exchange_completed" },
    return_complete:  { from: "return_requested",   to: "return_completed" },
    cancel_confirm:   { from: "cancel_requested",   to: "cancelled" },
  };

  // 취소요청 반려 — 환불 없이 주문을 원래 흐름으로 복귀 (운송장이 있으면 배송중, 없으면 주문확인)
  if (action === "cancel_reject") {
    const r = await shopPool.query(
      `UPDATE orders
          SET status = CASE WHEN tracking_number IS NOT NULL THEN 'shipped' ELSE 'confirmed' END,
              updated_at = NOW()
        WHERE id = ANY($1::uuid[]) AND site = $2 AND status = 'cancel_requested'`,
      [orderIds, site]
    );
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }

  const t = TRANSITIONS[action];
  if (!t) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  // 취소요청 승인은 단순 상태 변경이 아니라 환불이 걸린 작업 — 건별로 취소 엔진을 태운다
  // (토스 전액 환불 → 상태 취소 → 재고 복원, 환불 실패 건은 상태 유지하고 건수로 보고)
  if (action === "cancel_confirm") {
    const targets = await shopPool.query(
      `SELECT id FROM orders WHERE id = ANY($1::uuid[]) AND site = $2 AND status = 'cancel_requested'`,
      [orderIds, site]
    );
    let updated = 0;
    const failed: string[] = [];
    for (const row of targets.rows) {
      const r = await cancelShopOrder(
        row.id,
        deduct_shipping ? "취소요청 승인 (단순 변심)" : "취소요청 승인",
        { deductShipping: !!deduct_shipping }
      );
      if (r.ok) updated++;
      else failed.push(r.error);
    }
    return NextResponse.json({
      ok: failed.length === 0,
      updated,
      failed: failed.length,
      ...(failed.length ? { error: `환불 실패 ${failed.length}건 — ${failed[0]}` } : {}),
    });
  }

  const result = await shopPool.query(
    `UPDATE orders SET status = $1     WHERE id = ANY($2::uuid[]) AND status = $3 AND site = $4`,
    [t.to, orderIds, t.from, site]
  );

  return NextResponse.json({ ok: true, updated: result.rowCount });
}
