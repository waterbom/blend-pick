import { collectionPath } from "@/lib/catalog-seo";
import type { MetadataRoute } from "next";
import shopPool from "@/lib/db-shop";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 산지픽 사이트맵 — sanjipick.blendpunch.com/sitemap.xml (proxy.ts 리라이트).
// 메인·전체 상품·산지 이야기 + 판매 중인 산지픽 카테고리 상품(/p/<id>)만 담는다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${SITES.sanjipick.host}`;
  const items: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
  ];
  try {
    const r = await shopPool.query(
      `SELECT id, category, COALESCE(updated_at, created_at) AS updated
         FROM products_shop
        WHERE status = 'active' AND is_visible = true AND category = ANY($1::text[])
        ORDER BY created_at DESC`,
      [SITES.sanjipick.categories]
    );
    const categories = new Set(r.rows.map(p => p.category === "산지픽 해산물" ? "seafood" : "produce"));
    for (const category of categories) items.push({url:base+collectionPath(String(category)),changeFrequency:"daily",priority:0.8});
    for (const p of r.rows) {
      items.push({ url: `${base}/p/${p.id}`, lastModified: p.updated ?? undefined, changeFrequency: "daily", priority: 0.8 });
    }
  } catch (error) {
    throw error; // Never publish an incomplete sitemap when the catalog cannot be read.
  }
  return items;
}
