import shopPool from "@/lib/db-shop";

export type ShopCancelResult =
  | { ok: true; alreadyCancelled?: true; refunded: boolean }
  | { ok: false; error: string; httpStatus: number };

/**
 * 일반 상품 주문 취소 엔진 — 고객 셀프 취소·관리자 취소·취소요청 승인이 공유.
 * 순서가 핵심: 토스 전액 환불 성공 → 상태 취소 + 재고 복원.
 * 환불이 실패하면 주문을 건드리지 않아 "취소됐는데 돈은 그대로"가 생기지 않는다.
 * 환불 후 DB가 실패해도 재시도 시 ALREADY_CANCELED_PAYMENT를 정상 처리해 이어간다.
 */
export async function cancelShopOrder(
  orderId: string,
  reason: string
): Promise<ShopCancelResult> {
  const { rows } = await shopPool.query(
    `SELECT status, payment_key FROM orders WHERE id = $1 AND order_type <> 'hotel'`,
    [orderId]
  );
  const ord = rows[0];
  if (!ord) return { ok: false, error: "주문을 찾을 수 없습니다.", httpStatus: 404 };
  if (ord.status === "cancelled") return { ok: true, alreadyCancelled: true, refunded: false };

  // 1) 토스 전액 환불 (실결제 건만 — 시뮬레이션 키는 스킵)
  let refunded = false;
  if (ord.payment_key && !ord.payment_key.startsWith("SIM_")) {
    const secretKey = process.env.TOSS_SECRET_KEY;
    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${ord.payment_key}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancelReason: reason }),
      }
    );
    if (tossRes.ok) {
      refunded = true;
    } else {
      const e = await tossRes.json().catch(() => ({}));
      if (e.code !== "ALREADY_CANCELED_PAYMENT") {
        return {
          ok: false,
          error: e.message || "결제 환불에 실패했습니다. 잠시 후 다시 시도해주세요.",
          httpStatus: 400,
        };
      }
    }
  }

  // 2) 상태 취소 + 재고 복원 (경쟁 대비 — 취소 전 상태일 때만 갱신, 복원도 그때만)
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    const u = await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status <> 'cancelled'`,
      [orderId]
    );
    if (u.rowCount) {
      const its = await client.query(
        `SELECT product_id, option_id, quantity FROM order_items
          WHERE order_id = $1 AND product_id IS NOT NULL`,
        [orderId]
      );
      for (const it of its.rows) {
        await client.query(`UPDATE products_shop SET stock = stock + $1 WHERE id = $2`, [it.quantity, it.product_id]);
        if (it.option_id) {
          await client.query(`UPDATE product_options SET stock = stock + $1 WHERE id = $2`, [it.quantity, it.option_id]);
        }
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[order-cancel] 상태 변경 실패 (환불은 완료됐을 수 있음):", e);
    return { ok: false, error: "취소 처리 중 오류가 발생했습니다. 다시 시도해주세요.", httpStatus: 500 };
  } finally {
    client.release();
  }

  return { ok: true, refunded };
}
