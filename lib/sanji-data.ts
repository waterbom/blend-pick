import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { SITES } from "@/lib/sites";

// 산지픽 판매 페이지 데이터 — 상품 관리에서 카테고리를 '산지픽'으로 지정한 상품만 다룬다.
// 루트(/)는 가장 최근 등록된 산지픽 상품을 곧바로 판매 페이지로 보여주고, 나머지는 "함께 본 상품"으로 깔린다.

export interface SanjiProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  shipping_type: string;
  shipping_cost: number;
  free_shipping_threshold: number | null;
  per_unit_shipping_cost: number | null;
  main_image: string | null;
  influencer_id: string | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  origin?: string | null;                                           // 원산지 (상품정보 표에 표시)
  trust?: { rating: number; count: number; source: string } | null; // 외부 스토어 평점·리뷰 수 (우리 후기가 없을 때 신뢰 표시)
}

export interface SanjiOption {
  id: string;
  name: string;
  value: string;
  extra_price: number;
  stock: number;
  is_active: boolean;
}

export interface SanjiReview {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  created_at: string;
  option_label: string | null;
}

export interface SanjiCard {
  id: string;
  name: string;
  brand: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  stock: number;
  status: string;
  sale_start_at: string | null;
  sale_end_at: string | null;
  created_at: string;
  sold: number; // 누적 판매 수량 (베스트 정렬용)
}

// 메인 후기 리스트 — 산지픽 상품 전체의 최근 후기
export interface SanjiHomeReview {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  image: string | null;
  created_at: string;
  product_id: string;
  product_name: string;
}

// 구매 지표 — 슬라이드 위 "재구매" 알림, 특가 바 등 사회적 증거용
export interface SanjiStats {
  buyers: number; // 결제 완료 주문 기준 고유 구매자 수 (전체)
  rebuyers: number; // 최근 3개월 2회 이상 구매한 사람 수
  sold: number; // 누적 판매 수량
}

const CATS = SITES.sanjipick.categories;

export async function getSanjiProducts(): Promise<SanjiCard[]> {
  try {
    const r = await shopPool.query(
      `SELECT p.id, p.name, p.brand, p.price, p.original_price, p.main_image, p.stock, p.status,
              p.sale_start_at, p.sale_end_at, p.created_at,
              COALESCE((SELECT SUM(oi.quantity)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
                         WHERE oi.product_id = p.id AND o.status <> 'cancelled' AND o.status <> 'pending'), 0) AS sold
         FROM products_shop p
        WHERE p.category = ANY($1::text[]) AND p.status IN ('active', 'soldout')
        ORDER BY p.created_at DESC`,
      [CATS]
    );
    return r.rows as SanjiCard[];
  } catch {
    return [];
  }
}

export async function getSanjiHomeReviews(limit = 8): Promise<SanjiHomeReview[]> {
  try {
    const r = await shopPool.query(
      `SELECT rv.id, rv.buyer_name, rv.rating, rv.content, rv.created_at, rv.product_id,
              (CASE WHEN rv.images IS NOT NULL AND array_length(rv.images, 1) > 0 THEN rv.images[1] ELSE p.main_image END) AS image,
              p.name AS product_name
         FROM reviews rv JOIN products_shop p ON p.id = rv.product_id
        WHERE p.category = ANY($1::text[]) AND rv.is_hidden = false
        ORDER BY rv.created_at DESC LIMIT $2`,
      [CATS, limit]
    );
    return r.rows as SanjiHomeReview[];
  } catch {
    return [];
  }
}

export async function getSanjiProduct(id: string): Promise<SanjiProduct | null> {
  const r = await shopPool.query(
    `SELECT id, name, brand, category, description, price, original_price, stock, status,
            shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost,
            main_image, influencer_id, sale_start_at, sale_end_at
       FROM products_shop WHERE id = $1`,
    [id]
  );
  return (r.rows[0] as SanjiProduct) ?? null;
}

export async function getSanjiImages(productId: string): Promise<string[]> {
  const r = await shopPool.query(
    `SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC`,
    [productId]
  );
  return r.rows.map((x) => x.url as string);
}

export async function getSanjiOptions(productId: string): Promise<SanjiOption[]> {
  const r = await shopPool.query(
    `SELECT id, name, value, extra_price, stock, is_active
       FROM product_options WHERE product_id = $1 ORDER BY sort_order ASC, name ASC`,
    [productId]
  );
  return r.rows as SanjiOption[];
}

export async function getSanjiReviews(productId: string): Promise<{ list: SanjiReview[]; total: number; average: number }> {
  const [list, sum] = await Promise.all([
    shopPool.query(
      `SELECT rv.id, rv.buyer_name, rv.rating, rv.content, rv.images, rv.created_at,
              (SELECT oi.option_label FROM order_items oi
                WHERE oi.order_id = rv.order_id AND oi.product_id = rv.product_id LIMIT 1) AS option_label
         FROM reviews rv WHERE rv.product_id = $1 AND rv.is_hidden = false
        ORDER BY (CASE WHEN rv.images IS NOT NULL AND array_length(rv.images, 1) > 0 THEN 0 ELSE 1 END), rv.created_at DESC
        LIMIT 30`,
      [productId]
    ),
    shopPool.query(
      `SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS average
         FROM reviews WHERE product_id = $1 AND is_hidden = false`,
      [productId]
    ),
  ]);
  return { list: list.rows as SanjiReview[], total: sum.rows[0].total, average: Number(sum.rows[0].average) };
}

export async function getSanjiStats(productId: string): Promise<SanjiStats> {
  try {
    const r = await shopPool.query(
      `WITH bought AS (
         SELECT o.buyer_phone, o.created_at, oi.quantity
           FROM orders o JOIN order_items oi ON oi.order_id = o.id
          WHERE oi.product_id = $1 AND o.status <> 'cancelled' AND o.status <> 'pending'
       )
       SELECT COUNT(DISTINCT buyer_phone)::int AS buyers,
              COALESCE(SUM(quantity), 0)::int AS sold,
              (SELECT COUNT(*)::int FROM (
                 SELECT buyer_phone FROM bought
                  WHERE created_at >= NOW() - INTERVAL '3 months'
                  GROUP BY buyer_phone HAVING COUNT(*) >= 2) t) AS rebuyers
         FROM bought`,
      [productId]
    );
    const row = r.rows[0];
    return { buyers: row.buyers, sold: row.sold, rebuyers: row.rebuyers };
  } catch {
    return { buyers: 0, sold: 0, rebuyers: 0 };
  }
}

// 인플루언서 전용 링크(?inf=) — 존재하는 인플루언서만 귀속 (상품 상세와 동일 규칙)
export async function getInfluencerId(inf?: string): Promise<string | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id FROM influencers WHERE id = $1", [inf]);
    return r.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// 판매 페이지 한 벌 — 상품 + 이미지 + 옵션 + 후기 + 지표 + 함께 본 상품
export async function loadSanjiSalesPage(productId: string, inf?: string) {
  const [product, images, options, reviews, stats, all, influencerId] = await Promise.all([
    getSanjiProduct(productId),
    getSanjiImages(productId),
    getSanjiOptions(productId),
    getSanjiReviews(productId),
    getSanjiStats(productId),
    getSanjiProducts(),
    getInfluencerId(inf),
  ]);
  if (!product) return null;
  const attributed = influencerId && (!product.influencer_id || product.influencer_id === influencerId) ? influencerId : null;
  return {
    product,
    images: [...(product.main_image ? [product.main_image] : []), ...images],
    options,
    reviews,
    stats,
    others: all.filter((p) => p.id !== product.id),
    influencerId: attributed,
  };
}

// 예시 상품(상품 등록 전 화면 채우기)은 lib/sanji-demo.ts — 여기선 타입만 제공
export type { SanjiDemoProduct } from "@/lib/sanji-demo";
export { SANJI_DEMO_CARDS, SANJI_DEMO_REVIEWS, SANJI_DEMO_PRODUCTS, demoById } from "@/lib/sanji-demo";
