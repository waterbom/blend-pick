"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shopUnitPrice } from "@/lib/shop-price";

interface CartItem {
  id: string;
  quantity: number;
  product_id: string;
  name: string;
  brand: string;
  price: number;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
  status: string;
  stock: number;
  option_id: string | null;
  option_name: string | null;
  option_value: string | null;
  extra_price: number | null;
}

export default function CartClient() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCart() {
    const res = await fetch("/api/cart");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => { fetchCart(); }, []);

  async function updateQty(cartId: string, quantity: number) {
    await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart_id: cartId, quantity }),
    });
    setItems((prev) => prev.map((i) => i.id === cartId ? { ...i, quantity } : i));
  }

  async function removeItem(cartId: string) {
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart_id: cartId }),
    });
    setItems((prev) => prev.filter((i) => i.id !== cartId));
  }

  const availableItems = items.filter((i) => i.status !== "soldout" && i.stock > 0);
  const totalAmount = availableItems.reduce((sum, i) => {
    return sum + shopUnitPrice(i.price, i.extra_price, i.option_id != null) * i.quantity;
  }, 0);
  const shippingCost = availableItems.some((i) => i.shipping_type !== "free") ? 3000 : 0;

  if (loading) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: "var(--text-muted)" }}>
        불러오는 중...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-32">
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>장바구니가 비어있습니다</p>
        <Link href="/products" className="text-sm font-medium underline underline-offset-4" style={{ color: "var(--accent)" }}>
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>
        장바구니 <span className="text-base font-medium" style={{ color: "var(--text-muted)" }}>({items.length})</span>
      </h1>

      <div className="space-y-3 mb-6">
        {items.map((item) => {
          const unitPrice = shopUnitPrice(item.price, item.extra_price, item.option_id != null);
          const isSoldout = item.status === "soldout" || item.stock === 0;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 flex gap-4"
              style={{ border: "1px solid var(--line)", opacity: isSoldout ? 0.5 : 1 }}
            >
              <Link href={`/products/${item.product_id}`} className="shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden" style={{ background: "var(--cream-dark)" }}>
                  {item.main_image
                    ? <img src={item.main_image} alt={item.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{item.brand}</p>
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                {item.option_value && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>
                    {item.option_name}: {item.option_value}
                  </p>
                )}
                {isSoldout && (
                  <p className="text-xs mt-0.5 font-medium text-red-400">품절</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  {/* 수량 조절 */}
                  {!isSoldout && (
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                      <button
                        onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-50 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >−</button>
                      <span className="w-7 text-center text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-50 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >+</button>
                    </div>
                  )}
                  {isSoldout && <div />}

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {(unitPrice * item.quantity).toLocaleString()}원
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs transition-colors hover:text-red-400"
                      style={{ color: "var(--text-muted)" }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 결제 요약 */}
      <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
        <div className="space-y-2.5 text-sm mb-5 tnum" style={{ color: "var(--text-secondary)" }}>
          <div className="flex justify-between">
            <span>상품 금액</span>
            <span>{totalAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span>배송비</span>
            <span>{shippingCost === 0 ? "무료" : `${shippingCost.toLocaleString()}원`}</span>
          </div>
          <div
            className="flex justify-between items-baseline pt-3"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>총 결제 금액</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{(totalAmount + shippingCost).toLocaleString()}원</span>
          </div>
        </div>

        {availableItems.length === 0 ? (
          <p className="text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>
            구매 가능한 상품이 없습니다
          </p>
        ) : (
          <button
            className="w-full text-white font-bold py-3.5 rounded-2xl text-sm transition-all hover:brightness-95"
            style={{ background: "var(--accent)" }}
            onClick={() => {
              sessionStorage.setItem(
                "cartCheckoutData",
                JSON.stringify({
                  items: availableItems,
                  totalAmount,
                  shippingCost,
                })
              );
              router.push("/cart/checkout");
            }}
          >
            구매하기 ({(totalAmount + shippingCost).toLocaleString()}원)
          </button>
        )}

        <Link
          href="/products"
          className="block text-center text-sm mt-3 py-2"
          style={{ color: "var(--text-muted)" }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}
