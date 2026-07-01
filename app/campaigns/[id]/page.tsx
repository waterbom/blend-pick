import { notFound } from "next/navigation";
import Link from "next/link";
import pool from "@/lib/db";
import Header from "@/components/Header";
import FallbackImg from "@/components/FallbackImg";
import InfluencerSelector from "@/components/InfluencerSelector";
import RefundPolicy from "@/components/RefundPolicy";

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

  const shippingLabel =
    product.shipping_type === "free"
      ? "무료배송"
      : product.shipping_cost
      ? `${product.shipping_cost.toLocaleString()}원`
      : "배송비 별도";

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/campaigns" className="hover:underline">공동구매</Link>
          <span>›</span>
          <span>{product.category}</span>
          <span>›</span>
          <span style={{ color: "var(--text-primary)" }} className="truncate">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* 이미지 */}
          <div
            className="relative aspect-square overflow-hidden rounded-2xl"
            style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}
          >
            <FallbackImg
              src={product.product_image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {hasDiscount && (
              <span
                className="absolute top-3 left-3 text-white text-xs font-extrabold px-2.5 py-1 rounded-full"
                style={{ background: "var(--sale)" }}
              >
                -{discountRate}%
              </span>
            )}
          </div>

          {/* 정보 */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[11px] font-medium tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                {product.brand}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-snug tracking-tight" style={{ color: "var(--text-primary)" }}>
                {product.name}
              </h1>
            </div>

            {/* 가격 */}
            <div className="py-4 tnum" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              {hasDiscount ? (
                <>
                  <p className="text-xs line-through mb-1" style={{ color: "var(--text-muted)" }}>
                    {product.consumer_price.toLocaleString()}원
                  </p>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xl font-extrabold" style={{ color: "var(--sale)" }}>
                      {discountRate}%
                    </span>
                    <span className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                      {product.groupbuy_price.toLocaleString()}원
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {product.consumer_price.toLocaleString()}원
                </p>
              )}
            </div>

            {/* 배송 정보 */}
            <div className="text-sm space-y-2">
              <div className="flex gap-3">
                <span className="w-14 shrink-0" style={{ color: "var(--text-muted)" }}>배송</span>
                <span className="font-medium" style={{ color: product.shipping_type === "free" ? "var(--accent)" : "var(--text-secondary)" }}>
                  {shippingLabel}
                </span>
              </div>
              {product.dispatch_days && (
                <div className="flex gap-3">
                  <span className="w-14 shrink-0" style={{ color: "var(--text-muted)" }}>출고</span>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{product.dispatch_days}</span>
                </div>
              )}
            </div>

            {/* 옵션 구성 */}
            {product.set_options && product.set_options.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>구성</p>
                <div className="space-y-1.5">
                  {product.set_options.map((opt, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm rounded-xl px-3.5 py-2.5"
                      style={{ background: "var(--surface-soft)" }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>{opt.name}</span>
                      <span className="tnum" style={{ color: "var(--text-muted)" }}>x{opt.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 인플루언서 선택 + 구매 버튼 */}
            <div className="mt-1">
              <InfluencerSelector
                influencers={activeInfluencers}
                productId={product.id}
                displayPrice={displayPrice}
                isUpcoming={isUpcoming && activeInfluencers.length === 0}
              />
            </div>
          </div>
        </div>

        {/* 상품 설명 */}
        {product.description && (
          <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--line)" }}>
            <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>상품 설명</h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {product.description}
            </p>
          </div>
        )}

        {/* 주요 혜택 */}
        {product.key_benefits && product.key_benefits.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-bold mb-3" style={{ color: "var(--text-primary)" }}>주요 혜택</h2>
            <ul className="space-y-2">
              {product.key_benefits.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span className="mt-0.5" style={{ color: "var(--accent)" }}>✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <RefundPolicy />
      </div>
    </main>
  );
}
