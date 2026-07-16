import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ShopCheckoutClient from "@/components/ShopCheckoutClient";
import { shopUnitPrice } from "@/lib/shop-price";

async function getProduct(id: string) {
  const result = await shopPool.query(
    `SELECT id, name, brand, price, original_price, main_image, shipping_type, shipping_cost, status, stock
     FROM products_shop WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getOption(optionId: string) {
  const result = await shopPool.query(
    `SELECT id, name, value, extra_price FROM product_options WHERE id = $1`,
    [optionId]
  );
  return result.rows[0] || null;
}

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 귀속
async function getInfluencer(inf?: string): Promise<{ id: string } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id FROM influencers WHERE id = $1", [inf]);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ShopCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ optionId?: string; quantity?: string; inf?: string }>;
}) {
  const { id } = await params;
  const { optionId, quantity: qStr, inf } = await searchParams;
  const influencer = await getInfluencer(inf);
  const quantity = Math.max(1, parseInt(qStr ?? "1") || 1);

  const [product, option] = await Promise.all([
    getProduct(id),
    optionId ? getOption(optionId) : null,
  ]);

  if (!product) notFound();

  const unitPrice = shopUnitPrice(product.price, option?.extra_price, !!option);
  const shippingCost = product.shipping_type === "free" ? 0 : (product.shipping_cost ?? 0);
  const totalAmount = unitPrice * quantity + shippingCost;
  const clientKey = process.env.TOSS_CLIENT_KEY!;

  const orderName = option
    ? `${product.name} (${option.value})`
    : product.name;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>주문 / 결제</h1>

        {/* 상품 요약 */}
        <div className="bg-white rounded-2xl p-5 mb-4 flex gap-4 items-center" style={{ border: "1px solid var(--line)" }}>
          {product.main_image && (
            <img src={product.main_image} alt={product.name} className="w-16 h-16 object-cover rounded-xl" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{product.brand}</p>
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{product.name}</p>
            {option && (
              <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>{option.name}: {option.value}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>수량 {quantity}개</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{(unitPrice * quantity).toLocaleString()}원</p>
            {shippingCost > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>배송비 {shippingCost.toLocaleString()}원</p>
            )}
          </div>
        </div>

        <ShopCheckoutClient
          influencerId={influencer?.id ?? null}
          productId={product.id}
          productName={product.name}
          optionId={option?.id ?? null}
          optionLabel={option ? `${option.name}: ${option.value}` : null}
          unitPrice={unitPrice}
          quantity={quantity}
          shippingCost={shippingCost}
          totalAmount={totalAmount}
          orderName={orderName}
          clientKey={clientKey}
        />
      </div>
    </main>
  );
}
