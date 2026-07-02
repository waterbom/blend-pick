import { notFound } from "next/navigation";
import pool from "@/lib/db";
import CheckoutClient from "@/components/CheckoutClient";

interface SetOption {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
  shipping_type: string | null;
  shipping_cost: number | null;
  set_options: SetOption[] | null;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, consumer_price, groupbuy_price,
              product_image, shipping_type, shipping_cost, set_options
       FROM products
       WHERE id = $1 AND status = 'active' AND visibility_status = 'active'`,
      [id]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opt?: string; qty?: string; influencer_name?: string }>;
}) {
  const { id } = await params;
  const { opt, qty } = await searchParams;
  const product = await getProduct(id);

  if (!product) notFound();

  const displayPrice =
    product.groupbuy_price > 0 && product.groupbuy_price < product.consumer_price
      ? product.groupbuy_price
      : product.consumer_price;

  // 선택 옵션 → 가격은 DB의 set_options에서 재조회(클라이언트 값 신뢰 X)
  const optIndex = opt != null ? parseInt(opt, 10) : NaN;
  const selectedOption =
    !Number.isNaN(optIndex) && product.set_options && product.set_options[optIndex]
      ? product.set_options[optIndex]
      : null;

  const unitPrice = selectedOption ? selectedOption.price : displayPrice;
  const quantity = Math.max(1, parseInt(qty ?? "1", 10) || 1);

  const shippingCost =
    product.shipping_type === "free" ? 0 : (product.shipping_cost ?? 0);
  const itemTotal = unitPrice * quantity;

  const orderName = selectedOption
    ? `${product.name} (${selectedOption.name})`
    : product.name;

  const clientKey = process.env.TOSS_CLIENT_KEY!;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>주문 / 결제</h1>

        {/* 상품 요약 */}
        <div className="bg-white rounded-2xl p-5 mb-4 flex gap-4 items-center" style={{ border: "1px solid var(--line)" }}>
          {product.product_image && (
            <img
              src={product.product_image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-xl"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{product.brand}</p>
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{product.name}</p>
            {selectedOption && (
              <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>{selectedOption.name}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>수량 {quantity}개</p>
          </div>
          <div className="text-right shrink-0 tnum">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {itemTotal.toLocaleString()}원
            </p>
            {shippingCost > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                배송비 {shippingCost.toLocaleString()}원
              </p>
            )}
          </div>
        </div>

        <CheckoutClient
          productId={product.id}
          productName={orderName}
          unitPrice={unitPrice}
          quantity={quantity}
          shippingCost={shippingCost}
          clientKey={clientKey}
        />
      </div>
    </main>
  );
}
