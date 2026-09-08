import shopPool from "@/lib/db-shop";

// '지금 판매 중' 공통 SQL 조건 — 시작 예약이 지났고(또는 없음) 종료일이 아직 안 지난(또는 없음) 상품만.
// 메인·상품 목록·카테고리 탭이 모두 이 조건을 써서, 공구가 끝난 상품이 status를 안 바꿔도 자동으로 빠진다.
// (어드민 대시보드 '진행 중 공구' 집계와 같은 기준)
export const ON_SALE_SQL =
  `(sale_start_at IS NULL OR sale_start_at <= NOW()) AND (sale_end_at IS NULL OR sale_end_at >= NOW())`;

// '전시' 상품만 — 비전시(비밀링크 전용) 상품은 메인·목록·검색·사이트맵 어디에도 안 나온다.
// 상세 URL·비밀링크로 직접 들어오면 그대로 구매 가능 (lib/secret-link.ts)
export const VISIBLE_SQL = `is_visible = true`;

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
