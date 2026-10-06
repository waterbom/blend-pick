import type { Metadata } from "next";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import BlendHome from "@/components/blend/BlendHome";
import { getTopSellerIds } from "@/lib/best-sellers";
import type { HomeProduct, HomeUpcoming } from "@/lib/blend-home";
import { ON_SALE_SQL, VISIBLE_SQL } from "@/lib/sale-window";
import { SITES } from "@/lib/sites";
import { deferDbFreeBuild } from "@/lib/ci-db-free-build";

export const metadata: Metadata = {
  title: "블랜드픽 — 이런 것까지 공구가 된다고?",
  description: "일상에 필요한 제품부터 호텔과 독채 숙박까지. 블랜드픽에서 카테고리별 공동구매를 발견하고 상품별 가격과 이용 조건을 확인하세요.",
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

async function getSellingProducts(): Promise<{ products: HomeProduct[]; unavailable: boolean }> {
  try {
    const result = await shopPool.query<ProductRow>(
      `SELECT id, name, brand, category, price, original_price, stock, status, main_image, shipping_type, shipping_cost
       FROM products_shop
       WHERE status = 'active' AND ${VISIBLE_SQL} AND ${ON_SALE_SQL} AND category <> ALL($1::text[])
       ORDER BY created_at DESC
       LIMIT 12`,
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

// 첫 화면의 12개에 없는 분류도 전체 상품 목록으로 연결할 수 있도록 조회한다.
async function getCategories(): Promise<string[]> {
  try {
    const result = await shopPool.query<{ category: string }>(
      `SELECT DISTINCT category FROM products_shop
       WHERE status = 'active' AND ${VISIBLE_SQL} AND ${ON_SALE_SQL} AND category <> ALL($1::text[])
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
    getSellingProducts(),
    getUpcomingProducts(),
    getCategories(),
    getTopSellerIds(2),
  ]);

  return (
    <main>
      <Header variant="discovery" />
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
