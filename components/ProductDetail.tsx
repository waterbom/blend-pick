"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function buildCheckoutUrl(productId: string, optionId: string | null, quantity: number) {
  const params = new URLSearchParams({ quantity: String(quantity) });
  if (optionId) params.set("optionId", optionId);
  return `/products/${productId}/checkout?${params.toString()}`;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  status: string;
  shipping_type: string;
  shipping_cost: number;
  main_image: string | null;
}

interface ProductImage {
  id: string;
  url: string;
  sort_order: number;
}

interface ProductOption {
  id: string;
  name: string;
  value: string;
  extra_price: number;
  stock: number;
  sort_order: number;
}

interface Review {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  created_at: string;
}

// 옵션을 name 기준으로 그룹핑
function groupOptions(options: ProductOption[]) {
  const map = new Map<string, ProductOption[]>();
  for (const opt of options) {
    if (!map.has(opt.name)) map.set(opt.name, []);
    map.get(opt.name)!.push(opt);
  }
  return map;
}

export default function ProductDetail({
  product,
  images,
  options,
  reviews,
}: {
  product: Product;
  images: ProductImage[];
  options: ProductOption[];
  reviews: Review[];
}) {
  const router = useRouter();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartDone, setCartDone] = useState(false);

  // 최근 본 상품 localStorage 저장 + 페이지 떠날 때 이벤트 발송
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recentProducts") || "[]";
      const ids: string[] = JSON.parse(raw);
      const filtered = ids.filter((id) => id !== product.id);
      filtered.unshift(product.id);
      localStorage.setItem("recentProducts", JSON.stringify(filtered.slice(0, 10)));
    } catch {}

    return () => {
      // 페이지 떠날 때 InquiryButton에 갱신 요청
      window.dispatchEvent(new CustomEvent("recentProductsUpdated"));
    };
  }, [product.id]);

  const grouped = groupOptions(options);
  const isSoldout = product.status === "soldout" || product.stock === 0;
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  // 선택된 옵션 기준 추가금액 합산
  const extraPrice = Object.values(selectedOptions).reduce((sum, optId) => {
    const opt = options.find((o) => o.id === optId);
    return sum + (opt?.extra_price ?? 0);
  }, 0);
  const finalPrice = product.price + extraPrice;

  // 모든 옵션 그룹에서 선택 완료 여부
  const allOptionsSelected = grouped.size === 0 || [...grouped.keys()].every((k) => selectedOptions[k]);

  // 선택된 옵션 중 품절 여부
  const selectedOptionSoldout = Object.values(selectedOptions).some((optId) => {
    const opt = options.find((o) => o.id === optId);
    return opt && opt.stock === 0;
  });

  const canBuy = !isSoldout && !selectedOptionSoldout && allOptionsSelected;

  async function handleAddCart() {
    if (!canBuy) return;
    setCartLoading(true);
    try {
      const optionId = Object.values(selectedOptions)[0] ?? null;
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          option_id: optionId,
          quantity,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        setCartDone(true);
        setTimeout(() => setCartDone(false), 2000);
      }
    } finally {
      setCartLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        <Link href="/products" className="hover:underline">Products</Link>
        <span>›</span>
        <span>{product.category}</span>
        <span>›</span>
        <span style={{ color: "var(--text-primary)" }}>{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
        {/* 이미지 영역 */}
        <div>
          <div
            className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3"
            style={{ background: "var(--cream-dark)" }}
          >
            {images.length > 0 ? (
              <img
                src={images[activeImage].url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">📦</div>
            )}
            {isSoldout && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(0,0,0,0.45)" }}>
                <span className="text-white text-lg font-bold">품절</span>
              </div>
            )}
            {discount && !isSoldout && (
              <span className="absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--accent)" }}>
                -{discount}%
              </span>
            )}
          </div>
          {/* 썸네일 */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className="w-16 h-16 rounded-xl overflow-hidden shrink-0 transition-all"
                  style={{
                    border: activeImage === i ? "2px solid var(--accent)" : "2px solid transparent",
                    background: "var(--cream-dark)",
                  }}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="flex flex-col">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{product.brand}</p>
          <h1 className="text-xl font-bold leading-snug mb-4" style={{ color: "var(--text-primary)" }}>
            {product.name}
          </h1>

          {/* 가격 */}
          <div className="flex items-end gap-2 mb-1">
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {finalPrice.toLocaleString()}원
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-sm line-through mb-0.5" style={{ color: "var(--text-muted)" }}>
                {product.original_price.toLocaleString()}원
              </span>
            )}
          </div>
          {extraPrice > 0 && (
            <p className="text-xs mb-4" style={{ color: "var(--accent)" }}>
              옵션 추가금액 +{extraPrice.toLocaleString()}원 포함
            </p>
          )}

          {/* 배송 */}
          <div className="py-3 mb-4 text-sm" style={{ borderTop: "1px solid var(--warm-gray)", borderBottom: "1px solid var(--warm-gray)", color: "var(--text-secondary)" }}>
            {product.shipping_type === "free"
              ? "무료배송"
              : `배송비 ${product.shipping_cost.toLocaleString()}원`}
          </div>

          {/* 옵션 선택 */}
          {grouped.size > 0 && (
            <div className="space-y-3 mb-6">
              {[...grouped.entries()].map(([groupName, opts]) => (
                <div key={groupName}>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    {groupName}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {opts.map((opt) => {
                      const isSelected = selectedOptions[groupName] === opt.id;
                      const isOptSoldout = opt.stock === 0;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => !isOptSoldout && setSelectedOptions((prev) => ({ ...prev, [groupName]: opt.id }))}
                          disabled={isOptSoldout}
                          className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                          style={{
                            border: isSelected ? "1.5px solid var(--accent)" : "1.5px solid var(--warm-gray)",
                            color: isOptSoldout ? "var(--text-muted)" : isSelected ? "var(--accent)" : "var(--text-secondary)",
                            background: isSelected ? "var(--accent-soft)" : "#fff",
                            textDecoration: isOptSoldout ? "line-through" : "none",
                            cursor: isOptSoldout ? "not-allowed" : "pointer",
                          }}
                        >
                          {opt.value}
                          {opt.extra_price > 0 && ` (+${opt.extra_price.toLocaleString()}원)`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 수량 */}
          {!isSoldout && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>수량</span>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--warm-gray)" }}>
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 flex items-center justify-center text-lg transition-colors hover:bg-gray-50"
                  style={{ color: "var(--text-secondary)" }}
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 flex items-center justify-center text-lg transition-colors hover:bg-gray-50"
                  style={{ color: "var(--text-secondary)" }}
                >
                  +
                </button>
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                총 {(finalPrice * quantity).toLocaleString()}원
              </span>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 mt-auto">
            <button
              onClick={handleAddCart}
              disabled={!canBuy || cartLoading}
              className="flex-1 py-3.5 rounded-xl text-sm font-medium transition-all"
              style={{
                border: "1.5px solid var(--accent)",
                color: canBuy ? "var(--accent)" : "var(--text-muted)",
                borderColor: canBuy ? "var(--accent)" : "var(--warm-gray)",
                background: "#fff",
                cursor: !canBuy ? "not-allowed" : "pointer",
              }}
            >
              {cartDone ? "담겼어요 ✓" : cartLoading ? "처리중..." : isSoldout ? "품절" : "장바구니"}
            </button>
            {canBuy ? (
              <Link
                href={buildCheckoutUrl(product.id, Object.values(selectedOptions)[0] ?? null, quantity)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white text-center transition-all"
                style={{ background: "var(--accent)" }}
              >
                바로 구매
              </Link>
            ) : (
              <button
                disabled
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "var(--warm-gray)", cursor: "not-allowed" }}
              >
                {isSoldout ? "품절" : "바로 구매"}
              </button>
            )}
          </div>

          {/* 옵션 미선택 안내 */}
          {grouped.size > 0 && !allOptionsSelected && !isSoldout && (
            <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
              옵션을 선택해주세요
            </p>
          )}
        </div>
      </div>

      {/* 상품 상세 설명 */}
      {product.description && (
        <div className="mb-16">
          <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>상품 상세</h2>
          <div
            className="rounded-2xl p-6 text-sm leading-relaxed whitespace-pre-wrap"
            style={{ background: "var(--cream-dark)", color: "var(--text-secondary)" }}
          >
            {product.description}
          </div>
        </div>
      )}

      {/* 리뷰 섹션 */}
      <div>
        <h2 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          리뷰 {reviews.length > 0 && <span style={{ color: "var(--accent)" }}>{reviews.length}</span>}
        </h2>
        {reviews.length === 0 ? (
          <div className="rounded-2xl py-12 text-center text-sm" style={{ background: "var(--cream-dark)", color: "var(--text-muted)" }}>
            아직 리뷰가 없습니다
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid var(--warm-gray)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.buyer_name}</span>
                    <span className="text-xs" style={{ color: "var(--accent)" }}>
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.content}</p>
                {r.images && r.images.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {r.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-16 h-16 rounded-xl object-cover" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
