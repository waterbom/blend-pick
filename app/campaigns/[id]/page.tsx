import { notFound } from "next/navigation";
import pool from "@/lib/db";
import InfluencerSelector from "@/components/InfluencerSelector";

interface ActiveInfluencer {
  id: string;
  name: string;
  platform: string | null;
  profile_image: string | null;
}

async function getActiveInfluencers(productId: string): Promise<ActiveInfluencer[]> {
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.platform, i.profile_image
       FROM campaigns c
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.product_id = $1
         AND c.is_archived = false
         AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
         AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       ORDER BY c.end_date ASC`,
      [productId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

async function isUpcomingProduct(productId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM campaigns
       WHERE product_id = $1
         AND is_archived = false
         AND start_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
       LIMIT 1`,
      [productId]
    );
    return result.rowCount! > 0;
  } catch {
    return false;
  }
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
  description: string | null;
  key_benefits: string[] | null;
  set_options: { name: string; qty: number; price: number; notes?: string }[] | null;
  shipping_type: string | null;
  shipping_cost: number | null;
  dispatch_days: string | null;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, category, consumer_price, groupbuy_price,
              product_image, description, key_benefits, set_options,
              shipping_type, shipping_cost, dispatch_days
       FROM products
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, activeInfluencers, isUpcoming] = await Promise.all([
    getProduct(id),
    getActiveInfluencers(id),
    isUpcomingProduct(id),
  ]);

  if (!product) notFound();

  const hasDiscount =
    product.groupbuy_price > 0 &&
    product.groupbuy_price < product.consumer_price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.groupbuy_price / product.consumer_price) * 100)
    : 0;
  const displayPrice = hasDiscount ? product.groupbuy_price : product.consumer_price;

  return (
    <main className="min-h-screen bg-white">

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* 이미지 */}
          <div className="aspect-square bg-gray-50 overflow-hidden rounded-xl">
            {product.product_image ? (
              <img
                src={product.product_image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200 text-sm">
                이미지 없음
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">{product.brand}</p>
              <h1 className="text-xl font-bold text-gray-900 leading-snug">
                {product.name}
              </h1>
            </div>

            {/* 가격 */}
            <div className="border-t border-b border-gray-100 py-4">
              {hasDiscount ? (
                <>
                  <p className="text-xs text-gray-400 line-through mb-0.5">
                    {product.consumer_price.toLocaleString()}원
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-red-500 font-bold text-lg">
                      {discountRate}%
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {product.groupbuy_price.toLocaleString()}원
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-2xl font-bold text-gray-900">
                  {product.consumer_price.toLocaleString()}원
                </p>
              )}
            </div>

            {/* 배송 정보 */}
            <div className="text-sm text-gray-500 space-y-1">
              <div className="flex gap-2">
                <span className="text-gray-400 w-16">배송</span>
                <span>
                  {product.shipping_type === "free"
                    ? "무료배송"
                    : product.shipping_cost
                    ? `${product.shipping_cost.toLocaleString()}원`
                    : "배송비 별도"}
                </span>
              </div>
              {product.dispatch_days && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-16">출고</span>
                  <span>{product.dispatch_days}</span>
                </div>
              )}
            </div>

            {/* 옵션 */}
            {product.set_options && product.set_options.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">구성</p>
                <div className="space-y-1">
                  {product.set_options.map((opt, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-700">{opt.name}</span>
                      <span className="text-gray-400">x{opt.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 인플루언서 선택 + 구매 버튼 */}
            <InfluencerSelector
              influencers={activeInfluencers}
              productId={product.id}
              displayPrice={displayPrice}
              isUpcoming={isUpcoming && activeInfluencers.length === 0}
            />
          </div>
        </div>

        {/* 상품 설명 */}
        {product.description && (
          <div className="mt-12 border-t border-gray-100 pt-8">
            <h2 className="text-base font-semibold text-gray-900 mb-4">상품 설명</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {product.description}
            </p>
          </div>
        )}

        {/* 주요 혜택 */}
        {product.key_benefits && product.key_benefits.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-gray-900 mb-3">주요 혜택</h2>
            <ul className="space-y-2">
              {product.key_benefits.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600">
                  <span className="text-gray-300 mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
