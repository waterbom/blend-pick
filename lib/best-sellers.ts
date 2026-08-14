import shopPool from "@/lib/db-shop";

/**
 * 판매량 상위 상품 ID — 취소 제외 주문의 수량 합 기준.
 * 메인·상품 목록 카드의 "판매 N위" 배지용. 실패 시 빈 배열(배지만 안 붙고 페이지는 정상).
 */
export async function getTopSellerIds(limit = 2): Promise<string[]> {
  try {
    const r = await shopPool.query(
      `SELECT oi.product_id
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id IS NOT NULL
          AND o.status <> 'cancelled'
          AND o.order_type IN ('shop', 'campaign')
        GROUP BY oi.product_id
        ORDER BY SUM(oi.quantity) DESC
        LIMIT $1`,
      [limit]
    );
    return r.rows.map((x: { product_id: string }) => x.product_id);
  } catch (e) {
    console.error("[best-sellers] 판매량 집계 실패:", e);
    return [];
  }
}
