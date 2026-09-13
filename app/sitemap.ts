import { collectionPath } from "@/lib/catalog-seo";
import type { MetadataRoute } from "next";
import shopPool from "@/lib/db-shop";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 블랜드픽 사이트맵 — 검색엔진에 "여기 이런 페이지들이 있다"고 알려주는 목록.
// 판매중 상품은 DB에서 자동으로 포함된다 (내려간 상품·산지픽 카테고리 상품은 제외 — 산지픽은 app/sanji/sitemap.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://shop.blendpunch.com";
  const items: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/hotel`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const r = await shopPool.query(
      `SELECT id, category, COALESCE(updated_at, created_at) AS updated
         FROM products_shop
        WHERE status = 'active' AND is_visible = true AND category <> ALL($1::text[])
        ORDER BY created_at DESC`,
      [SITES.sanjipick.categories]
    );
    const categories = new Set(r.rows.map(p => p.category).filter((c):c is string => typeof c==="string" && !!c.trim()));
    for (const category of categories) items.push({url:base+collectionPath(category),changeFrequency:"daily",priority:0.8});
    for (const p of r.rows) {
      items.push({
        url: `${base}/products/${p.id}`,
        lastModified: p.updated ?? undefined,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch (error) {
    throw error; // Never publish an incomplete sitemap when the catalog cannot be read.
    // DB 문제로 상품 목록을 못 읽어도 정적 페이지만으로 사이트맵은 유효
  }
  return items;
}
