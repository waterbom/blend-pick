import shopPool from "@/lib/db-shop";

// 판매 시간창 검사 — 오픈 전이거나 종료된 상품이 하나라도 있으면 그 상품명 반환 (없으면 null)
// 결제 승인 직전에 호출해 오픈 전 결제를 서버에서 최종 차단한다 (UI 차단과 별개의 이중 방어)
export async function findClosedSaleProduct(productIds: (string | null | undefined)[]): Promise<string | null> {
  const ids = [...new Set(productIds.filter(Boolean))] as string[];
  if (!ids.length) return null;
  const r = await shopPool.query(
    `SELECT name FROM products_shop
      WHERE id = ANY($1)
        AND ((sale_start_at IS NOT NULL AND sale_start_at > NOW())
          OR (sale_end_at IS NOT NULL AND sale_end_at < NOW()))
      LIMIT 1`,
    [ids]
  );
  return r.rows[0]?.name ?? null;
}
