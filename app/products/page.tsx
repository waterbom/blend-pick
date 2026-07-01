import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import Link from "next/link";
import FallbackImg from "@/components/FallbackImg";


interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  original_price: number | null;
  stock: number;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
}

async function getProducts(category?: string) {
  const params: string[] = [];
  let where = `WHERE status = 'active'`;
  if (category) {
    params.push(category);
    where += ` AND category = $1`;
  }
  const result = await shopPool.query(
    `SELECT id, name, brand, category, price, original_price, stock, main_image, shipping_type, shipping_cost
     FROM products_shop ${where} ORDER BY created_at DESC`,
    params
  );
  return result.rows as Product[];
}

async function getCategories() {
  const result = await shopPool.query(
    `SELECT DISTINCT category FROM products_shop WHERE status = 'active' ORDER BY category`
  );
  return result.rows.map((r) => r.category as string);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    getProducts(category),
    getCategories(),
  ]);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="container-blend pt-8 sm:pt-10 pb-16">
        {/* 헤더 */}
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-2" style={{ color: "var(--accent)" }}>
            BLEND PICK SHOP
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Products
          </h1>
          <div className="mt-3 h-0.5 w-12 rounded-full" style={{ background: "var(--accent)" }} />
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/products"
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !category
                ? "text-white"
                : "hover:opacity-80"
            }`}
            style={!category
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--cream-dark)", color: "var(--text-secondary)" }
            }
          >
            전체
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/products?category=${encodeURIComponent(cat)}`}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors hover:opacity-80"
              style={category === cat
                ? { background: "var(--accent)", color: "#fff" }
                : { background: "var(--cream-dark)", color: "var(--text-secondary)" }
              }
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* 상품 그리드 */}
        {products.length === 0 ? (
          <div className="text-center py-32" style={{ color: "var(--text-muted)" }}>
            등록된 상품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6 gap-x-4 gap-y-8">
            {products.map((p) => {
              const discount = p.original_price && p.original_price > p.price
                ? Math.round((1 - p.price / p.original_price) * 100)
                : null;

              return (
                <Link key={p.id} href={`/products/${p.id}`} className="group cursor-pointer block">
                  {/* 이미지 */}
                  <div
                    className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3"
                    style={{ background: "var(--cream-dark)" }}
                  >
                    <FallbackImg
                      src={p.main_image}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {discount && (
                      <span
                        className="absolute top-2 left-2 text-white text-xs font-extrabold px-2 py-0.5 rounded-full"
                        style={{ background: "var(--sale)" }}
                      >
                        -{discount}%
                      </span>
                    )}
                    {p.stock === 0 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-2xl"
                        style={{ background: "rgba(0,0,0,0.4)" }}
                      >
                        <span className="text-white text-sm font-bold">품절</span>
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div>
                    <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{p.brand}</p>
                    <p className="text-sm font-medium line-clamp-2 leading-snug mb-1.5" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                        {p.price.toLocaleString()}원
                      </span>
                      {p.original_price && p.original_price > p.price && (
                        <span className="text-xs line-through" style={{ color: "var(--text-muted)" }}>
                          {p.original_price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: p.shipping_type === "free" ? "var(--accent)" : "var(--text-muted)" }}>
                      {p.shipping_type === "free" ? "무료배송" : `배송비 ${p.shipping_cost.toLocaleString()}원`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
