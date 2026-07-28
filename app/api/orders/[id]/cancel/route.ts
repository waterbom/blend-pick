import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelShopOrder } from "@/lib/order-cancel";

// POST /api/orders/[id]/cancel
// paid 상태 → 즉시 cancelled (어드민 확인 불필요)
// confirmed/preparing 상태 → cancel_requested (어드민 확인 필요)
// shipped 이후 → 취소 불가
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { rows } = await shopPool.query(
    `SELECT id, status, user_id FROM orders WHERE id = $1`,
    [id]
  );

  if (!rows[0]) return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });

  const order = rows[0];

  if (order.user_id !== payload.id) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const UNCANCELLABLE = ["shipped", "delivered", "cancelled", "exchange_requested",
    "exchange_completed", "return_requested", "return_completed", "cancel_requested"];

  if (UNCANCELLABLE.includes(order.status)) {
    return NextResponse.json({ error: "이미 배송이 시작되어 취소할 수 없습니다" }, { status: 400 });
  }

  // paid → 즉시 취소 (토스 전액 환불 + 재고 복원까지 — 환불 실패 시 상태 유지)
  // confirmed/preparing → 취소요청 (어드민 확인 시 환불 처리)
  if (order.status === "paid") {
    const r = await cancelShopOrder(id, "고객 주문 취소");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.httpStatus });
    return NextResponse.json({
      ok: true,
      status: "cancelled",
      message: r.refunded
        ? "주문이 취소되었습니다. 결제하신 금액은 전액 환불 처리됐어요. (카드사에 따라 3~5일 소요)"
        : "주문이 취소되었습니다.",
    });
  }

  await shopPool.query(
    `UPDATE orders SET status = 'cancel_requested', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return NextResponse.json({
    ok: true,
    status: "cancel_requested",
    message:
      "취소 요청이 접수되었습니다. 확인 후 환불 처리되며, 단순 변심에 의한 취소는 배송비를 제외한 금액이 환불됩니다.",
  });
}
