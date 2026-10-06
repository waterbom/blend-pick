import "server-only";
import type { QueryConfig } from "pg";
import shopPool from "@/lib/db-shop";
import { BLEND_CATALOG_SQL, BLEND_CLOSED_SQL, VISIBLE_SQL } from "@/lib/sale-window";
import { SITES } from "@/lib/sites";
import { plainText } from "@/lib/product-seo";
import { expectedShipLabel } from "@/lib/checkout-draft";
import { shippingLabel } from "@/lib/shipping";
import { REFUND_POLICY_SECTIONS } from "@/components/RefundPolicy";

export type BlendHelpCatalog = {
  context: string;
  links: { label: string; href: string }[];
};

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  price: number | string | null;
  sale_state: "open" | "upcoming" | "soldout" | "ended";
  sale_start_kst: string | null;
  sale_end_kst: string | null;
  snapshot_kst: string;
  description?: string | null;
  shipping_type?: string;
  shipping_cost?: number | string | null;
  free_shipping_threshold?: number | string | null;
  per_unit_shipping_cost?: number | string | null;
  island_shipping_cost?: number | string | null;
  installation_cost?: number | string | null;
  expected_ship_date?: string | null;
};

const MAX_INDEX = 80;
const MAX_DETAILS = 4;
const CONTEXT_LIMIT = 10000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_WHERE = `${VISIBLE_SQL} AND category <> ALL($1::text[])
  AND ((${BLEND_CATALOG_SQL}) OR
       (status = 'active' AND sale_start_at > NOW() AND (sale_end_at IS NULL OR sale_end_at >= NOW())))`;
const STATE_SQL = `CASE WHEN ${BLEND_CLOSED_SQL} THEN 'ended'
  WHEN sale_start_at > NOW() THEN 'upcoming'
  WHEN status = 'soldout' OR stock = 0 THEN 'soldout' ELSE 'open' END`;
const PUBLIC_COLUMNS = `id, LEFT(name, 160) AS name, LEFT(category, 60) AS category, LEFT(brand, 80) AS brand, price,
  ${STATE_SQL} AS sale_state,
  to_char(sale_start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS sale_start_kst,
  to_char(sale_end_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS sale_end_kst,
  to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS snapshot_kst`;
const LABELS: Record<CatalogRow["sale_state"], string> = {
  open: "진행 중", upcoming: "오픈 예정", soldout: "품절", ended: "공구 마감",
};

// Installed pg supports per-query read timeouts, although @types/pg exposes
// query_timeout only on connection configuration.
function boundedQuery(sql: string, values: string[][]): QueryConfig & { query_timeout: number } {
  return { text: sql, values, query_timeout: 5000 };
}

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return plainText(plainText(value.slice(0, 12000)))
    .replace(/(?:https?:\/\/|www\.)[^\s<>"']+/gi, "[외부 링크 생략]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[연락처 생략]")
    .replace(/\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "[연락처 생략]")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function amount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function queryTokens(query: string, rows: CatalogRow[]): string[] {
  const tokens = query.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u).slice(0, 80);
  const names = rows.map(row => normalized(text(row.name, 160)));
  const expanded = [...tokens];
  for (const token of tokens) {
    const stem = token.replace(/(?:에서는|에는|에서|에게|으로|은|는|을|를|의|도|만|이|가|로)$/u, "");
    if (stem !== token && stem.length >= 2 && names.filter(name => name.includes(stem)).length === 1) expanded.push(stem);
  }
  return expanded;
}

function score(row: CatalogRow, query: string, tokens: string[]): number {
  const name = normalized(text(row.name, 160));
  const brand = normalized(text(row.brand, 80));
  const category = normalized(text(row.category, 60));
  const compact = normalized(query);
  let value = name.length >= 2 && compact.includes(name) ? 100 : 0;
  if (brand.length >= 2 && compact.includes(brand)) value += 20;
  if (category.length >= 2 && compact.includes(category)) value += 10;
  for (const token of tokens) {
    if (token.length >= 2 && name.includes(token)) value += 5;
  }
  return value;
}

function publicShipping(row: CatalogRow): string {
  const shippingCost = amount(row.shipping_cost);
  if (!row.shipping_type || !["free", "paid", "conditional_free", "per_unit"].includes(row.shipping_type)
    || shippingCost == null
    || (row.shipping_type === "conditional_free" && !(amount(row.free_shipping_threshold) ?? 0))
    || (row.shipping_type === "per_unit" && amount(row.per_unit_shipping_cost) == null)) {
    return "배송비는 상품 상세와 최종 주문서에서 확인";
  }
  return shippingLabel({
    shipping_type: row.shipping_type,
    shipping_cost: shippingCost,
    free_shipping_threshold: amount(row.free_shipping_threshold),
    per_unit_shipping_cost: amount(row.per_unit_shipping_cost),
    island_shipping_cost: amount(row.island_shipping_cost),
    installation_cost: amount(row.installation_cost),
  });
}

function details(row: CatalogRow) {
  return {
    상품명: text(row.name, 120), 분류: text(row.category, 40), 브랜드: text(row.brand, 60),
    표시가격원: amount(row.price), 판매상태: LABELS[row.sale_state] ?? "상태 확인 필요",
    공구시작KST: text(row.sale_start_kst, 16) || "미등록", 공구종료KST: text(row.sale_end_kst, 16) || "미등록",
    배송안내: text(publicShipping(row), 180), 출고안내: expectedShipLabel(row.expected_ship_date),
    공개설명: text(row.description, 700) || "등록된 텍스트 설명 없음. 상세 페이지 확인 필요",
  };
}

/** Read-only public product data for an AI response; no order, private link, or supplier data. */
export async function getBlendHelpCatalog(pagePath: string, query: string): Promise<BlendHelpCatalog> {
  try {
    const currentMatch = typeof pagePath === "string" ? /^\/products\/([0-9a-f-]{36})$/i.exec(pagePath) : null;
    const currentId = currentMatch && UUID.test(currentMatch[1]) ? currentMatch[1].toLowerCase() : null;
    const question = typeof query === "string" ? query.slice(0, 4000) : "";
    const result = await shopPool.query<CatalogRow>(boundedQuery(
      `SELECT ${PUBLIC_COLUMNS} FROM products_shop WHERE ${PUBLIC_WHERE}
       ORDER BY CASE WHEN ${BLEND_CLOSED_SQL} THEN 3 WHEN status = 'soldout' OR stock = 0 THEN 2
                     WHEN sale_start_at > NOW() THEN 1 ELSE 0 END, created_at DESC
       LIMIT 80`,
      [SITES.sanjipick.categories],
    ));
    const rows = result.rows.slice(0, MAX_INDEX).filter(row => typeof row.id === "string" && UUID.test(row.id));
    const tokens = queryTokens(question, rows);
    const matched = rows.map(row => ({ row, score: score(row, question, tokens) }))
      .filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    const selectedIds = [...new Set([...(currentId ? [currentId] : []), ...matched.map(item => item.row.id)])].slice(0, MAX_DETAILS);
    let selected: CatalogRow[] = [];
    if (selectedIds.length) {
      const detailResult = await shopPool.query<CatalogRow>(boundedQuery(
        `SELECT ${PUBLIC_COLUMNS}, LEFT(description, 6000) AS description,
                shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost, island_shipping_cost, installation_cost,
                expected_ship_date::text AS expected_ship_date
         FROM products_shop WHERE ${PUBLIC_WHERE} AND id = ANY($2::uuid[]) LIMIT 4`,
        [SITES.sanjipick.categories, selectedIds],
      ));
      selected = selectedIds.map(id => detailResult.rows.find(row => row.id === id)).filter((row): row is CatalogRow => !!row);
    }
    const data = {
      조회상태: "성공",
      조회시각KST: text(result.rows[0]?.snapshot_kst, 19) || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium" }).format(new Date()),
      시간대: "Asia/Seoul",
      목록범위: "공개 블랜드픽 상품 중 판매상태·등록일 기준 최대 80개를 조회한 목록입니다. 아래 목록은 전체가 아닐 수 있으며, 빠진 상품이 없거나 판매 종료됐다고 단정할 수 없습니다.",
      확인범위: "상품에 표시된 가격·일정·상태의 조회 시점 정보입니다. 옵션별 최종 가격·재고와 배송비는 상세·주문서 확인이 필요합니다. 개인 주문·예약, 호텔 실시간 객실 재고는 조회하지 않았습니다.",
      관련상품: selected.map(details),
      일반상품환불안내: REFUND_POLICY_SECTIONS.filter(section => section.title !== "배송")
        .map(section => ({ 항목: section.title, 안내: section.items.filter(item => !item.startsWith("반품 주소:")).map(item => text(item, 160)) })),
      환불적용범위: "일반 상품 상세의 공통 안내입니다. 숙박·예약에는 적용하지 않으며 개별 취소·환불 가능 여부를 확정하지 않습니다.",
      상품목록열: ["상품명", "분류", "표시가격원", "판매상태", "공구시작KST", "공구종료KST"],
      상품목록: [] as unknown[][],
      목록일부생략: rows.length >= MAX_INDEX,
    };
    for (const row of rows) {
      data.상품목록.push([text(row.name, 64), text(row.category, 24), amount(row.price), LABELS[row.sale_state] ?? "상태 확인 필요",
        text(row.sale_start_kst, 16) || "미등록", text(row.sale_end_kst, 16) || "미등록"]);
      if (JSON.stringify(data).length > CONTEXT_LIMIT) {
        data.상품목록.pop();
        data.목록일부생략 = true;
        break;
      }
    }
    return {
      context: JSON.stringify(data),
      links: selected.map(row => ({ label: text(row.name, 70) || "상품 상세 보기", href: `/products/${row.id}` })),
    };
  } catch {
    // The API must stop before requesting a model response when retrieval fails.
    // Do not forward database diagnostics or connection details to the caller.
    throw new Error("PUBLIC_CATALOG_UNAVAILABLE");
  }
}
