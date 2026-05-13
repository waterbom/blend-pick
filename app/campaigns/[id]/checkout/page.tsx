import { notFound } from "next/navigation";
import pool from "@/lib/db";
import CheckoutClient from "@/components/CheckoutClient";

interface Product {
  id: string;
  name: string;
  brand: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
  shipping_type: string | null;
  shipping_cost: number | null;
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, brand, consumer_price, groupbuy_price,
              product_image, shipping_type, shipping_cost
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const displayPrice =
    product.groupbuy_price > 0 && product.groupbuy_price < product.consumer_price
      ? product.groupbuy_price
      : product.consumer_price;

  const shippingCost =
    product.shipping_type === "free" ? 0 : (product.shipping_cost ?? 0);

  const clientKey = process.env.TOSS_CLIENT_KEY!;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-bold text-gray-900 mb-6">주문 / 결제</h1>

        {/* 상품 요약 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 flex gap-4 items-center">
          {product.product_image && (
            <img
              src={product.product_image}
              alt={product.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">{product.brand}</p>
            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-900">
              {displayPrice.toLocaleString()}원
            </p>
            {shippingCost > 0 && (
              <p className="text-xs text-gray-400">
                배송비 {shippingCost.toLocaleString()}원
              </p>
            )}
          </div>
        </div>

        <CheckoutClient
          productId={product.id}
          productName={product.name}
          unitPrice={displayPrice}
          shippingCost={shippingCost}
          clientKey={clientKey}
        />
      </div>
    </main>
  );
}
