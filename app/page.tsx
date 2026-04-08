import pool from "@/lib/db";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

async function getProducts(): Promise<Product[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, category, consumer_price, groupbuy_price, product_image
       FROM products
       WHERE status = 'active' AND visibility_status = 'active'
       ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Blend Pick</h1>
      </header>

      {/* 상품 목록 */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          공구 진행 중 ({products.length}개)
        </h2>

        {products.length === 0 ? (
          <p className="text-gray-400 text-center py-20">진행 중인 상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {product.product_image ? (
                    <img
                      src={product.product_image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-300 text-sm">이미지 없음</span>
                  )}
                </div>

                <div className="p-3">
                  <p className="text-xs text-gray-400">{product.brand}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">
                    {product.name}
                  </p>
                  <div className="mt-2">
                    {product.groupbuy_price > 0 ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">
                          {product.consumer_price.toLocaleString()}원
                        </p>
                        <p className="text-base font-bold text-blue-600">
                          {product.groupbuy_price.toLocaleString()}원
                        </p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-gray-900">
                        {product.consumer_price.toLocaleString()}원
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
