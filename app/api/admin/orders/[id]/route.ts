import { currentAdminSite, adminOrderIdsBelong } from "@/lib/admin-site";
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
  const site = (await currentAdminSite()).key;

  const { id } = await params;
  const { status, tracking_company, tracking_number } = await request.json();

  if (!(await adminOrderIdsBelong([id], site))) return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });

  const VALID = [
    "confirmed", "preparing", "shipped", "delivered", "cancelled",
    "exchange_requested", "exchange_completed",
    "return_requested", "return_completed",
    "cancel_requested",
  ];
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // 취소 전환은 상태 변경 전에 토스 전액 환불부터 — 환불 실패 시 상태를 건드리지 않는다
  // (호텔 취소 엔진과 같은 순서. 환불 성공 후 DB가 실패해도 재시도 시
  //  ALREADY_CANCELED_PAYMENT를 정상 처리해 이어서 진행된다)
  if (status === "cancelled") {
    const cur = await shopPool.query(
      `SELECT status, payment_key FROM orders WHERE id = $1 AND site = $2`, [id, site]
    );
    const ord = cur.rows[0];
    if (!ord) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (ord.status !== "cancelled" && ord.payment_key && !ord.payment_key.startsWith("SIM_")) {
      const secretKey = process.env.TOSS_SECRET_KEY;
      const tossRes = await fetch(
        `https://api.tosspayments.com/v1/payments/${ord.payment_key}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cancelReason: "관리자 주문 취소" }),
        }
      );
      if (!tossRes.ok) {
        const e = await tossRes.json().catch(() => ({}));
        if (e.code !== "ALREADY_CANCELED_PAYMENT") {
          return NextResponse.json(
            { error: e.message || "결제 환불에 실패했어요. 토스 상점관리자에서 결제 상태를 확인해주세요." },
            { status: 400 }
          );
        }
      }
    }
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // 취소 전환 시 재고 복원용 — 이전 상태 확인 (이미 취소된 주문은 중복 복원 방지)
    const prev = await client.query(`SELECT status FROM orders WHERE id = $1 AND site = $2`, [id, site]);
    const prevStatus = prev.rows[0]?.status;

    // 주문 상태 변경 (운송장 정보 있으면 함께 저장)
    const { rows } = await client.query(
      `UPDATE orders
       SET status = $1,
           shipped_at   = CASE WHEN $1 = 'shipped'   THEN COALESCE(shipped_at, NOW())   ELSE shipped_at END,
           delivered_at = CASE WHEN $1 = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
           tracking_company = COALESCE($3, tracking_company),
           tracking_number  = COALESCE($4, tracking_number)
       WHERE id = $2 AND site = $5
       RETURNING id, order_number, total_amount, payment_method, payment_key`,
      [status, id, tracking_company ?? null, tracking_number ?? null, site]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];

    // 취소 확정 → 재고 복원 (결제 시 차감한 만큼 되돌림, 추가옵션 제외)
    if (status === "cancelled" && prevStatus !== "cancelled") {
      const its = await client.query(
        `SELECT product_id, option_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL`,
        [id]
      );
      for (const it of its.rows) {
        await client.query(`UPDATE products_shop SET stock = stock + $1 WHERE id = $2`, [it.quantity, it.product_id]);
        if (it.option_id) {
          await client.query(`UPDATE product_options SET stock = stock + $1 WHERE id = $2`, [it.quantity, it.option_id]);
        }
      }
    }

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
