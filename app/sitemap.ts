import type { MetadataRoute } from "next";
import shopPool from "@/lib/db-shop";

// 사이트맵 — 검색엔진에 "여기 이런 페이지들이 있다"고 알려주는 목록.
// 판매중 상품은 DB에서 자동으로 포함된다 (내려간 상품은 자동 제외).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://shop.blendpunch.com";
  const items: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/campaigns`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/hotel`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const r = await shopPool.query(
      `SELECT id, COALESCE(updated_at, created_at) AS updated
         FROM products_shop WHERE status = 'active' ORDER BY created_at DESC LIMIT 500`
    );
    for (const p of r.rows) {
      items.push({
        url: `${base}/products/${p.id}`,
        lastModified: p.updated ?? undefined,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // DB 문제로 상품 목록을 못 읽어도 정적 페이지만으로 사이트맵은 유효
  }
  return items;
}
