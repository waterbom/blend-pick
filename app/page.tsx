import type { Metadata } from "next";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import BlendHome from "@/components/blend/BlendHome";
import { getTopSellerIds } from "@/lib/best-sellers";
import type { HomeProduct, HomeUpcoming } from "@/lib/blend-home";
import { BLEND_CATALOG_SQL, BLEND_CLOSED_SQL, VISIBLE_SQL } from "@/lib/sale-window";
import { SITES } from "@/lib/sites";
import { deferDbFreeBuild } from "@/lib/ci-db-free-build";

export const metadata: Metadata = {
  title: "공동구매 쇼핑·숙박 공구 | 블랜드픽",
  description: "공동구매 사이트 블랜드픽에서 생활용품과 숙박·호텔 공구를 둘러보세요. 진행 중인 상품과 가격·옵션·공구 기간, 구매·예약 조건을 확인할 수 있습니다.",
  alternates: { canonical: "/" },
};

// 산지픽 상품은 산지픽 전용 홈페이지와 목록에서만 보여준다.
const SANJI_CATS = SITES.sanjipick.categories;

type ProductRow = Omit<HomeProduct, "brand" | "price" | "original_price" | "stock" | "shipping_cost"> & {
  brand: string | null;
  price: number | string;
  original_price: number | string | null;
  stock: number | string;
  shipping_cost: number | string;
};

async function getCatalogProducts(): Promise<{ products: HomeProduct[]; unavailable: boolean }> {
  try {
    const result = await shopPool.query<ProductRow>(
      `SELECT id, name, brand, category, price, original_price, stock, status, main_image, shipping_type, shipping_cost,
              ${BLEND_CLOSED_SQL} AS sale_closed
       FROM products_shop
       WHERE ${BLEND_CATALOG_SQL} AND ${VISIBLE_SQL} AND category <> ALL($1::text[])
       ORDER BY CASE WHEN ${BLEND_CLOSED_SQL} THEN 2 WHEN status = 'soldout' OR stock = 0 THEN 1 ELSE 0 END,
                created_at DESC`,
      [SANJI_CATS]
    );
    return {
      products: result.rows.map((product) => ({
        ...product,
        brand: product.brand ?? "",
        price: Number(product.price),
        original_price: product.original_price == null ? null : Number(product.original_price),
        stock: Number(product.stock),
        shipping_cost: Number(product.shipping_cost),
      })),
      unavailable: false,
    };
  } catch (error) {
    console.error("[home] 판매 상품 조회 실패:", error);
    return { products: [], unavailable: true };
  }
}

async function getUpcomingProducts(): Promise<HomeUpcoming[]> {
  try {
    const result = await shopPool.query<Omit<HomeUpcoming, "brand"> & { brand: string | null }>(
      `SELECT id, name, brand, main_image,
              to_char(sale_start_at AT TIME ZONE 'Asia/Seoul', 'FMMM. FMDD') AS open_label
       FROM products_shop
       WHERE status = 'active' AND ${VISIBLE_SQL} AND sale_start_at > NOW() AND category <> ALL($1::text[])
       ORDER BY sale_start_at ASC
       LIMIT 4`,
      [SANJI_CATS]
    );
    return result.rows.map((product) => ({ ...product, brand: product.brand ?? "" }));
  } catch (error) {
    console.error("[home] 오픈 예정 조회 실패:", error);
    return [];
  }
}

// 마감된 공구의 분류도 전체 상품 목록에서 다시 확인할 수 있도록 포함한다.
async function getCategories(): Promise<string[]> {
  try {
    const result = await shopPool.query<{ category: string }>(
      `SELECT DISTINCT category FROM products_shop
       WHERE ${BLEND_CATALOG_SQL} AND ${VISIBLE_SQL} AND category <> ALL($1::text[])
       ORDER BY category`,
      [SANJI_CATS]
    );
    return result.rows.map((row) => row.category);
  } catch (error) {
    console.error("[home] 상품 분류 조회 실패:", error);
    return [];
  }
}

export default async function Home() {
  // Next's DB-free build bailout must remain outside the query catches.
  await deferDbFreeBuild("/");
  const [catalog, upcoming, categories, topSellerIds] = await Promise.all([
    getCatalogProducts(),
    getUpcomingProducts(),
    getCategories(),
    getTopSellerIds(2),
  ]);

  return (
    <main>
      <Header />
      <BlendHome
        products={catalog.products}
        upcoming={upcoming}
        categories={categories}
        topSellerIds={topSellerIds}
        catalogUnavailable={catalog.unavailable}
      />
    </main>
  );
}
