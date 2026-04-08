import pool from "@/lib/db";
import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  brand: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

async function getBestProducts(): Promise<Product[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, consumer_price, groupbuy_price, product_image
       FROM products
       WHERE status = 'active' AND visibility_status = 'active'
         AND product_image IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 8`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function Home() {
  const best = await getBestProducts();
  const heroProducts = best.slice(0, 4);   // 배너용 4개
  const bestProducts = best.slice(0, 4);   // 베스트 4개

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* 히어로 배너 슬라이더 */}
      <HeroBanner products={heroProducts} />

      {/* BEST ITEMS */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black mb-10">BEST ITEMS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {bestProducts.map((product, idx) => {
            const hasDiscount = product.groupbuy_price > 0 && product.groupbuy_price < product.consumer_price;
            const discountRate = hasDiscount
              ? Math.round((1 - product.groupbuy_price / product.consumer_price) * 100)
              : 0;

            return (
              <Link key={product.id} href={`/products/${product.id}`} className="group block">
                <div className="relative aspect-square bg-gray-50 overflow-hidden mb-4">
                  <span className="absolute top-3 left-3 bg-black text-white text-xs font-bold w-6 h-6 flex items-center justify-center z-10">
                    {idx + 1}
                  </span>
                  {product.product_image && (
                    <img
                      src={product.product_image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1">{product.brand}</p>
                <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{product.name}</p>
                {hasDiscount ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-red-500 font-bold text-sm">{discountRate}%</span>
                    <span className="font-bold text-sm">{product.groupbuy_price.toLocaleString()}원</span>
                    <span className="text-xs text-gray-300 line-through">{product.consumer_price.toLocaleString()}원</span>
                  </div>
                ) : (
                  <p className="font-bold text-sm">{product.consumer_price.toLocaleString()}원</p>
                )}
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/products"
            className="inline-block border border-black text-sm font-medium px-8 py-3 hover:bg-black hover:text-white transition-colors"
          >
            전체 상품 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
