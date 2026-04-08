import pool from "@/lib/db";
import Header from "@/components/Header";
import CategoryFilter from "@/components/CategoryFilter";
import ProductCard from "@/components/ProductCard";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

const CATEGORIES = ["ALL", "식품/음료", "유아/육아", "건강기능식품", "생활용품", "주방용품", "욕실용품", "가전제품"];

async function getProducts(category?: string): Promise<Product[]> {
  try {
    const query = category && category !== "ALL"
      ? `SELECT id, name, brand, category, consumer_price, groupbuy_price, product_image
         FROM products
         WHERE status = 'active' AND visibility_status = 'active' AND category = $1
         ORDER BY created_at DESC`
      : `SELECT id, name, brand, category, consumer_price, groupbuy_price, product_image
         FROM products
         WHERE status = 'active' AND visibility_status = 'active'
         ORDER BY created_at DESC`;

    const result = category && category !== "ALL"
      ? await pool.query(query, [category])
      : await pool.query(query);

    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const products = await getProducts(category);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* 카테고리 탭 */}
      <div className="border-b border-gray-100 sticky top-[92px] bg-white z-40">
        <div className="max-w-6xl mx-auto px-6">
          <CategoryFilter categories={CATEGORIES} current={category || "ALL"} />
        </div>
      </div>

      {/* 상품 목록 */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-400 mb-6">{products.length}개 상품</p>
        {products.length === 0 ? (
          <p className="text-gray-300 text-center py-32">상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
