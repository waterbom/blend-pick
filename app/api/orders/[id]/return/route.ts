import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { RETURN_REASONS, SELLER_FAULT_REASONS } from "@/lib/returns";

// POST /api/orders/[id]/return — 교환·반품 신청 (마이페이지, 배송중·배송완료 주문만)
// 신청과 동시에 orders.status를 exchange_requested / return_requested로 바꾸고,
// 원래 상태(prev_status)를 기억해 거절 시 되돌린다. 진행 중 신청이 있으면 중복 차단.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const kind = body.kind === "exchange" ? "exchange" : body.kind === "return" ? "return" : null;
  if (!kind) return NextResponse.json({ error: "교환/반품 유형을 선택해주세요." }, { status: 400 });

  const reason = String(body.reason || "");
  if (!(RETURN_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "사유를 선택해주세요." }, { status: 400 });
  }
  const detail = String(body.detail || "").slice(0, 1000);
  if (reason === "기타" && !detail.trim()) {
    return NextResponse.json({ error: "기타 사유는 상세 내용을 입력해주세요." }, { status: 400 });
  }

  // 단순 변심은 배송비 고객 부담 — 동의 없이는 접수하지 않는다
  const sellerFault = SELLER_FAULT_REASONS.includes(reason);
  const feeAgreed = !!body.fee_agreed;
  if (!sellerFault && !feeAgreed) {
    return NextResponse.json(
      { error: "고객 사유의 교환·반품은 배송비 부담 동의가 필요해요." },
      { status: 400 }
    );
  }

  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map((v: unknown) => String(v))
    .filter((u: string) => u.startsWith("/uploads/returns/"))
    .slice(0, 5);

  const { rows } = await shopPool.query(
    `SELECT o.id, o.status, o.user_id, o.order_type, o.addr_address, o.addr_detail
       FROM orders o WHERE o.id = $1`,
    [id]
  );
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
  if (order.user_id !== payload.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }
  if (!["shop", "campaign"].includes(order.order_type)) {
    return NextResponse.json({ error: "교환·반품 신청 대상 주문이 아니에요." }, { status: 400 });
  }
  if (!["shipped", "delivered"].includes(order.status)) {
    return NextResponse.json(
      { error: "배송 중이거나 배송 완료된 주문만 교환·반품 신청이 가능해요." },
      { status: 400 }
    );
  }

  // 진행 중(접수·수거) 신청이 있으면 중복 차단
  const dup = await shopPool.query(
    `SELECT 1 FROM order_returns WHERE order_id = $1 AND status IN ('requested', 'collecting')`,
    [id]
  );
  if (dup.rows[0]) {
    return NextResponse.json({ error: "이미 진행 중인 교환·반품 신청이 있어요." }, { status: 409 });
  }

  // 신청 상품 검증 — 이 주문의 항목인지 + 수량이 주문 수량을 넘지 않는지
  const reqItems = (Array.isArray(body.items) ? body.items : [])
    .map((it: { item_id?: unknown; quantity?: unknown }) => ({
      item_id: String(it.item_id || ""),
      quantity: Math.floor(Number(it.quantity)) || 0,
    }))
    .filter((it: { item_id: string; quantity: number }) => it.item_id && it.quantity > 0);
  if (!reqItems.length) {
    return NextResponse.json({ error: "교환·반품할 상품을 선택해주세요." }, { status: 400 });
  }
  const oi = await shopPool.query(
    `SELECT id, product_name, option_label, unit_price, quantity FROM order_items WHERE order_id = $1`,
    [id]
  );
  const byId = new Map<string, { product_name: string; option_label: string | null; unit_price: number; quantity: number }>(
    oi.rows.map((r) => [String(r.id), r])
  );
  const items = [];
  for (const it of reqItems) {
    const src = byId.get(it.item_id);
    if (!src || it.quantity > Number(src.quantity)) {
      return NextResponse.json({ error: "신청 상품·수량이 주문 내역과 맞지 않아요." }, { status: 400 });
    }
    items.push({
      item_id: it.item_id,
      product_name: src.product_name,
      option_label: src.option_label,
      unit_price: Number(src.unit_price),
      quantity: it.quantity,
    });
  }

  const pickupAddress = String(body.pickup_address || order.addr_address || "").slice(0, 300);
  const pickupDetail = String(body.pickup_detail || order.addr_detail || "").slice(0, 200);

  const nextStatus = kind === "exchange" ? "exchange_requested" : "return_requested";
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO order_returns
         (order_id, kind, reason, detail, items, photos, pickup_address, pickup_detail, fee_agreed, prev_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [id, kind, reason, detail, JSON.stringify(items), JSON.stringify(photos),
       pickupAddress, pickupDetail, feeAgreed, order.status]
    );
    await client.query(
      `INSERT INTO order_return_events (return_id, status, note) VALUES ($1, 'requested', '고객 신청')`,
      [r.rows[0].id]
    );
    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [nextStatus, id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[return] 신청 실패:", e);
    return NextResponse.json({ error: "신청 처리에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({
    ok: true,
    message:
      kind === "exchange"
        ? "교환 신청이 접수되었습니다. 수거 및 교환 상품 발송 일정은 확인 후 안내드릴게요."
        : "반품 신청이 접수되었습니다. 수거 확인 후 환불 처리됩니다. (카드사에 따라 3~5일 소요)",
  });
}
