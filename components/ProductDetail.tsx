"use client";

import { useState, useEffect } from "react";
import FallbackImg from "@/components/FallbackImg";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shopUnitPrice } from "@/lib/shop-price";

function buildCheckoutUrl(productId: string, optionId: string | null, quantity: number, influencerId?: string | null) {
  const params = new URLSearchParams({ quantity: String(quantity) });
  if (optionId) params.set("optionId", optionId);
  if (influencerId) params.set("inf", influencerId); // 인플루언서 귀속 유지
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
  free_shipping_threshold: number | null;
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
  is_active: boolean;
}

// 옵션 구매 가능 여부: 판매중이고 재고가 있어야 함
function optUnavailable(o: ProductOption) {
  return !o.is_active || o.stock === 0;
}
function optLabel(o: ProductOption, productSoldout = false) {
  if (!o.is_active) return " · 판매중지";
  if (productSoldout || o.stock === 0) return " · 품절";
  return "";
}

interface Review {
  id: string;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  created_at: string;
}

// 선택한 옵션 한 줄(네이버식 옵션 조합) — 옵션마다 독립 수량
interface SelectedLine {
  optionId: string;
  qty: number;
}

// 추가옵션(추가상품)
interface ProductAddon {
  id: string;
  name: string;
  extra_price: number;
}

export default function ProductDetail({
  product,
  images,
  options,
  addons,
  addonMulti,
  reviews,
  influencerId,
  saleState = "open",
  openLabel = "",
}: {
  product: Product;
  images: ProductImage[];
  options: ProductOption[];
  addons: ProductAddon[];
  addonMulti: boolean;
  reviews: Review[];
  influencerId?: string | null;
  saleState?: "upcoming" | "open" | "ended"; // 판매 시간창 (서버 판정)
  openLabel?: string; // 오픈 예정 시각 표시용 "7/22 19:00"
}) {
  const router = useRouter();
  const [lines, setLines] = useState<SelectedLine[]>([]);
  const [quantity, setQuantity] = useState(1); // 옵션 없는 상품용
  const [selAddons, setSelAddons] = useState<Set<string>>(new Set()); // 선택된 추가옵션 id
  const [cartLoading, setCartLoading] = useState(false);
  const [cartDone, setCartDone] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const hasOptions = options.length > 0;
  const optById = (id: string) => options.find((o) => o.id === id);
  const isSoldout = product.status === "soldout" || product.stock === 0;
  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round((1 - product.price / product.original_price) * 100)
      : null;

  const shippingCost = product.shipping_type === "free" ? 0 : product.shipping_cost;

  // 옵션 상품: 선택 라인 합계 / 옵션 없는 상품: 기본가 × 수량
  const linesTotal = lines.reduce((sum, l) => {
    const o = optById(l.optionId);
    return sum + shopUnitPrice(product.price, o?.extra_price, true) * l.qty;
  }, 0);
  const itemsTotal = hasOptions ? linesTotal : product.price * quantity;
  const totalCount = hasOptions ? lines.reduce((s, l) => s + l.qty, 0) : quantity;

  // 추가옵션: 메인(옵션 선택 or 옵션없는 상품)이 정해져야 담을 수 있음
  const hasAddons = addons.length > 0;
  const mainSelected = hasOptions ? lines.length > 0 : true;
  const selectedAddons = mainSelected ? addons.filter((a) => selAddons.has(a.id)) : [];
  const addonsTotal = selectedAddons.reduce((s, a) => s + a.extra_price, 0);
  const grandTotal = itemsTotal + addonsTotal;

  function toggleAddon(id: string) {
    setSelAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!addonMulti) next.clear(); // 단일 선택 모드면 기존 선택 해제
        next.add(id);
      }
      return next;
    });
  }

  const anySelectedSoldout = lines.some((l) => {
    const o = optById(l.optionId);
    return !o || optUnavailable(o);
  });
  const saleClosed = saleState !== "open"; // 오픈 전이거나 종료됨
  const canBuy =
    !saleClosed && !isSoldout && (hasOptions ? lines.length > 0 && !anySelectedSoldout : true);

  // 드롭다운에서 옵션 추가 (이미 담긴 옵션은 무시)
  function addLine(optionId: string) {
    if (!optionId) return;
    setLines((prev) =>
      prev.some((l) => l.optionId === optionId) ? prev : [...prev, { optionId, qty: 1 }]
    );
  }
  function setLineQty(optionId: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.optionId === optionId ? { ...l, qty: Math.max(1, qty) } : l))
    );
  }
  function removeLine(optionId: string) {
    setLines((prev) => prev.filter((l) => l.optionId !== optionId));
  }

  async function handleAddCart() {
    if (!canBuy) return;
    setCartLoading(true);
    try {
      const payloads = hasOptions
        ? lines.map((l) => ({ product_id: product.id, option_id: l.optionId, quantity: l.qty }))
        : [{ product_id: product.id, option_id: null, quantity }];
      for (const body of payloads) {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
      }
      setCartDone(true);
      setTimeout(() => setCartDone(false), 2000);
    } finally {
      setCartLoading(false);
    }
  }

  function handleBuyNow() {
    if (!canBuy) return;

    // 추가옵션이 선택되지 않았고 옵션도 없는 단일상품 → 기존 단일 결제 흐름
    if (selectedAddons.length === 0 && !hasOptions) {
      router.push(buildCheckoutUrl(product.id, null, quantity, influencerId));
      return;
    }

    // 그 외(옵션 상품 or 추가옵션 포함) → 장바구니 결제 흐름(cartCheckoutData)으로 통일
    setBuyLoading(true);
    const base = {
      brand: product.brand,
      main_image: product.main_image,
      shipping_type: product.shipping_type,
      shipping_cost: product.shipping_cost,
      status: product.status,
    };
    // 메인 상품 items
    const mainItems = hasOptions
      ? lines.map((l) => {
          const o = optById(l.optionId)!;
          return {
            id: crypto.randomUUID(), // 실제 장바구니 행 아님 → cart 삭제 시 no-op
            product_id: product.id,
            name: product.name,
            price: product.price,
            ...base,
            stock: product.stock,
            option_id: o.id,
            option_name: o.name,
            option_value: o.value,
            extra_price: o.extra_price,
            quantity: l.qty,
          };
        })
      : [{
          id: crypto.randomUUID(),
          product_id: product.id,
          name: product.name,
          price: product.price,
          ...base,
          stock: product.stock,
          option_id: null,
          option_name: null,
          option_value: null,
          extra_price: null,
          quantity,
        }];
    // 추가옵션 items (product_id 없음, 고정가)
    const addonItems = selectedAddons.map((a) => ({
      id: crypto.randomUUID(),
      product_id: null,
      is_addon: true,
      name: `[추가] ${a.name}`,
      price: a.extra_price,
      ...base,
      stock: 9999,
      option_id: null,
      option_name: null,
      option_value: null,
      extra_price: null,
      quantity: 1,
    }));
    const items = [...mainItems, ...addonItems];
    sessionStorage.setItem(
      "cartCheckoutData",
      JSON.stringify({ items, totalAmount: grandTotal, shippingCost, influencerId: influencerId ?? null })
    );
    router.push("/cart/checkout");
  }

  const stepBtn = "w-9 h-9 flex items-center justify-center text-lg transition-colors hover:bg-gray-50";

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
        {/* 대표 이미지 */}
        <div
          className="relative w-full aspect-square rounded-2xl overflow-hidden"
          style={{ background: "var(--cream-dark)" }}
        >
          <FallbackImg
            src={images[0]?.url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isSoldout && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(0,0,0,0.45)" }}>
              <span className="text-white text-lg font-bold">품절</span>
            </div>
          )}
          {discount && !isSoldout && (
            <span className="absolute top-3 left-3 text-white text-xs font-extrabold px-2.5 py-1 rounded-full" style={{ background: "var(--sale)" }}>
              -{discount}%
            </span>
          )}
        </div>

        {/* 정보 영역 */}
        <div className="flex flex-col">
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{product.brand}</p>
          <h1 className="text-xl font-bold leading-snug mb-4" style={{ color: "var(--text-primary)" }}>
            {product.name}
          </h1>

          {/* 가격 (기본가) */}
          <div className="flex items-end gap-2.5 mb-4 tnum">
            {discount && (
              <span className="text-xl font-extrabold mb-0.5" style={{ color: "var(--sale)" }}>
                {discount}%
              </span>
            )}
            <span className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {product.price.toLocaleString()}원
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-sm line-through mb-1" style={{ color: "var(--text-muted)" }}>
                {product.original_price.toLocaleString()}원
              </span>
            )}
          </div>

          {/* 배송 */}
          <div className="py-3 mb-4 text-sm" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", color: "var(--text-secondary)" }}>
            {product.shipping_type === "free"
              ? "무료배송"
              : product.shipping_type === "conditional_free" && product.free_shipping_threshold
              ? `${product.free_shipping_threshold.toLocaleString()}원 이상 무료배송 (미만 ${product.shipping_cost.toLocaleString()}원)`
              : `배송비 ${product.shipping_cost.toLocaleString()}원`}
          </div>

          {/* 옵션 선택 (드롭다운 → 다중 라인) */}
          {hasOptions && (
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                옵션 선택 <span style={{ color: "var(--sale)" }}>(필수) *</span>
              </label>
              <select
                value=""
                onChange={(e) => {
                  addLine(e.target.value);
                  e.target.value = "";
                }}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ border: "1px solid var(--line)", background: "#fff", appearance: "auto", color: "var(--text-primary)" }}
              >
                <option value="" disabled>옵션</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id} disabled={isSoldout || optUnavailable(o)}>
                    {o.value}
                    {/* 옵션가는 그 자체가 판매 단가 — 기본가 대비 증감으로 표시해야 오해가 없다 */}
                    {(() => {
                      const diff = o.extra_price - product.price;
                      return diff === 0 ? "" : diff > 0 ? ` (+${diff.toLocaleString()}원)` : ` (−${(-diff).toLocaleString()}원)`;
                    })()}
                    {optLabel(o, isSoldout)}
                  </option>
                ))}
              </select>

              {/* 선택된 옵션 라인 */}
              {lines.length > 0 && (
                <div className="space-y-2 mt-3">
                  {lines.map((l) => {
                    const o = optById(l.optionId);
                    if (!o) return null;
                    const lineUnit = shopUnitPrice(product.price, o.extra_price, true);
                    return (
                      <div key={l.optionId} className="rounded-xl p-3" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{o.value}</span>
                          <button
                            onClick={() => removeLine(l.optionId)}
                            className="shrink-0 text-sm leading-none transition-colors hover:text-black"
                            style={{ color: "var(--text-muted)" }}
                            aria-label="옵션 삭제"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)", background: "#fff" }}>
                            <button onClick={() => setLineQty(l.optionId, l.qty - 1)} className="w-8 h-8 flex items-center justify-center text-base transition-colors hover:bg-gray-50" style={{ color: "var(--text-secondary)" }}>−</button>
                            <span className="w-9 text-center text-sm font-medium tnum" style={{ color: "var(--text-primary)" }}>{l.qty}</span>
                            <button onClick={() => setLineQty(l.optionId, l.qty + 1)} className="w-8 h-8 flex items-center justify-center text-base transition-colors hover:bg-gray-50" style={{ color: "var(--text-secondary)" }}>+</button>
                          </div>
                          <span className="text-sm font-bold tnum" style={{ color: "var(--text-primary)" }}>{(lineUnit * l.qty).toLocaleString()}원</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 수량 (옵션 없는 상품만) */}
          {!hasOptions && !isSoldout && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>수량</span>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className={stepBtn} style={{ color: "var(--text-secondary)" }}>−</button>
                <span className="w-10 text-center text-sm font-medium" style={{ color: "var(--text-primary)" }}>{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} className={stepBtn} style={{ color: "var(--text-secondary)" }}>+</button>
              </div>
            </div>
          )}

          {/* 추가옵션(추가상품) */}
          {hasAddons && !isSoldout && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                추가옵션 {!addonMulti && <span className="text-xs font-normal text-gray-400">(1개만 선택 가능)</span>}
              </p>
              {!mainSelected && (
                <p className="text-xs text-gray-400 mb-2">먼저 위에서 옵션을 선택하면 추가옵션을 담을 수 있어요.</p>
              )}
              <div className={`space-y-1.5 ${!mainSelected ? "opacity-40 pointer-events-none" : ""}`}>
                {addons.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selAddons.has(a.id)}
                      onChange={() => toggleAddon(a.id)}
                      disabled={!mainSelected}
                      className="w-4 h-4"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>{a.name}</span>
                    <span className="text-sm font-semibold tnum" style={{ color: "var(--text-secondary)" }}>
                      +{a.extra_price.toLocaleString()}원
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 합계 */}
          {(itemsTotal > 0 && (hasOptions ? lines.length > 0 : true) && !isSoldout) && (
            <div className="flex items-baseline justify-between mb-5 pt-1">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                총 {totalCount}개{addonsTotal > 0 ? ` + 추가옵션 ${selectedAddons.length}개` : ""}
              </span>
              <span className="text-2xl font-extrabold tnum" style={{ color: "var(--accent)" }}>
                {grandTotal.toLocaleString()}원
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
                border: "1.5px solid",
                color: canBuy ? "var(--accent)" : "var(--text-muted)",
                borderColor: canBuy ? "var(--accent)" : "var(--line)",
                background: "#fff",
                cursor: !canBuy ? "not-allowed" : "pointer",
              }}
            >
              {saleState === "upcoming" ? "오픈 전" : saleState === "ended" ? "공구 종료" : cartDone ? "담겼어요 ✓" : cartLoading ? "처리중..." : isSoldout ? "품절" : "장바구니"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!canBuy || buyLoading}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white text-center transition-all"
              style={{
                background: canBuy ? "var(--accent)" : "var(--warm-gray)",
                cursor: !canBuy ? "not-allowed" : "pointer",
              }}
            >
              {saleState === "upcoming"
                ? `⏰ 오픈 예정${openLabel ? ` · ${openLabel}` : ""}`
                : saleState === "ended" ? "공구가 종료됐어요"
                : buyLoading ? "이동중..." : isSoldout ? "품절" : "바로 구매"}
            </button>
          </div>

          {/* 옵션 미선택 안내 */}
          {hasOptions && lines.length === 0 && !isSoldout && (
            <p className="text-xs mt-2 text-center" style={{ color: "var(--text-muted)" }}>
              옵션을 선택해주세요
            </p>
          )}
        </div>
      </div>

      {/* 추가 이미지 — 세로 정렬 (원본이 커도 한눈에 보이게 폭 제한) */}
      {images.length > 1 && (
        <div className="mb-8 space-y-2 max-w-xl mx-auto">
          {images.slice(1).map((img, i) => (
            <FallbackImg
              key={img.id ?? i}
              src={img.url}
              alt={`상세 이미지 ${i + 1}`}
              className="w-full rounded-xl object-contain"
            />
          ))}
        </div>
      )}

      {/* 상품 상세 HTML */}
      {product.description && (
        <div className="mb-16">
          <div
            className="text-sm leading-relaxed product-desc max-w-xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
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
              <div key={r.id} className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid var(--line)" }}>
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
