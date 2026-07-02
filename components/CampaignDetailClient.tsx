"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FallbackImg from "@/components/FallbackImg";

interface SetOption {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}
interface Influencer {
  id: string;
  name: string;
  platform: string | null;
  profile_image: string | null;
}

interface Props {
  productId: string;
  brand: string;
  name: string;
  image: string | null;
  displayPrice: number;
  originalPrice: number | null;
  hasDiscount: boolean;
  discountRate: number;
  shippingType: string | null;
  shippingCost: number | null;
  dispatchDays: string | null;
  description: string | null;
  keyBenefits: string[] | null;
  setOptions: SetOption[] | null;
  influencers: Influencer[];
  endDate: string | null;
  isUpcoming: boolean;
}

/* ── 마감까지 남은 시간 ── */
function calc(target: string | null) {
  if (!target) return null;
  // 날짜만(YYYY-MM-DD) 오면 KST 그날 끝(23:59:59)을 마감으로 간주
  const end =
    target.length === 10 ? new Date(`${target}T23:59:59+09:00`) : new Date(target);
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

export default function CampaignDetailClient({
  productId,
  brand,
  name,
  image,
  displayPrice,
  originalPrice,
  hasDiscount,
  discountRate,
  shippingType,
  shippingCost,
  dispatchDays,
  description,
  keyBenefits,
  setOptions,
  influencers,
  endDate,
  isUpcoming,
}: Props) {
  const router = useRouter();
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedInf, setSelectedInf] = useState<string | null>(influencers[0]?.id ?? null);
  const [remaining, setRemaining] = useState(() => calc(endDate));

  useEffect(() => {
    if (!endDate) return;
    const t = setInterval(() => setRemaining(calc(endDate)), 1000);
    return () => clearInterval(t);
  }, [endDate]);

  const hasOptions = !!(setOptions && setOptions.length > 0);
  const unitPrice =
    hasOptions && selectedOpt !== null ? setOptions![selectedOpt].price : displayPrice;
  const total = unitPrice * quantity;

  const needOption = hasOptions && selectedOpt === null;
  const canBuy = !isUpcoming && !needOption;

  const shippingLabel =
    shippingType === "free"
      ? "무료배송"
      : shippingCost
      ? `배송비 ${shippingCost.toLocaleString()}원`
      : "배송비 별도";

  function handleBuy() {
    if (!canBuy) return;
    const params = new URLSearchParams({ qty: String(quantity) });
    if (hasOptions && selectedOpt !== null) params.set("opt", String(selectedOpt));
    const inf = influencers.find((i) => i.id === selectedInf);
    if (inf) {
      params.set("influencer_id", inf.id);
      params.set("influencer_name", inf.name);
    }
    router.push(`/campaigns/${productId}/checkout?${params.toString()}`);
  }

  const buyLabel = isUpcoming
    ? "곧 열릴 제품입니다"
    : needOption
    ? "옵션을 선택하세요"
    : `구매하기 · ${total.toLocaleString()}원`;

  return (
    <div className="max-w-md mx-auto px-4 pb-28">
      {/* 인플루언서 공구 (추천 문구 없이 최소 표기) */}
      {influencers.length > 0 && (
        <div className="pt-4">
          {influencers.length === 1 ? (
            <div
              className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--line)" }}
            >
              <Avatar inf={influencers[0]} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  @{influencers[0].name} 님의 공동구매
                </p>
                {influencers[0].platform && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{influencers[0].platform}</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--accent)" }}>
                🔥 {influencers.length}명이 공구 진행중 · 함께할 공구를 선택하세요
              </p>
              <div className="flex flex-col gap-2">
                {influencers.map((inf) => {
                  const on = selectedInf === inf.id;
                  return (
                    <button
                      key={inf.id}
                      onClick={() => setSelectedInf(inf.id)}
                      className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all"
                      style={{
                        background: on ? "#fff" : "var(--accent-soft)",
                        border: on ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                        boxShadow: on ? "var(--card-shadow)" : "none",
                      }}
                    >
                      <Avatar inf={inf} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{inf.name}</p>
                        {inf.platform && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{inf.platform}</p>}
                      </div>
                      {on && <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 대표 이미지 */}
      <div className="relative mt-4 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        <div className="aspect-square" style={{ background: "var(--surface-soft)" }}>
          <FallbackImg src={image} alt={name} className="w-full h-full object-cover" />
        </div>
        {hasDiscount && (
          <span
            className="absolute top-3 left-3 text-white text-xs font-extrabold px-2.5 py-1 rounded-full"
            style={{ background: "var(--sale)" }}
          >
            {discountRate}% OFF
          </span>
        )}
        {/* 하단 그린 악센트 바 */}
        <div className="h-1.5 w-full" style={{ background: "var(--accent)" }} />
      </div>

      {/* 브랜드 · 제목 */}
      <div className="mt-5">
        <p className="text-[11px] font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>{brand}</p>
        <h1 className="text-lg font-extrabold leading-snug tracking-tight mt-1" style={{ color: "var(--text-primary)" }}>
          {name}
        </h1>
      </div>

      {/* 가격 */}
      <div className="mt-3 tnum">
        <div className="flex items-baseline gap-2">
          {hasDiscount && (
            <span className="text-lg font-extrabold" style={{ color: "var(--sale)" }}>{discountRate}%</span>
          )}
          <span className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {displayPrice.toLocaleString()}원
          </span>
          {hasDiscount && originalPrice && (
            <span className="text-sm line-through" style={{ color: "var(--text-muted)" }}>
              {originalPrice.toLocaleString()}원
            </span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: shippingType === "free" ? "var(--accent)" : "var(--text-muted)" }}>
          {shippingLabel}
          {dispatchDays ? ` · ${dispatchDays}` : ""}
        </p>
      </div>

      {/* 한정 수량 배지 — 표시 전용(실제 재고 제한 없음) */}
      <div className="mt-3">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: "var(--sale-soft)", color: "var(--sale)" }}
        >
          🔥 한정 수량 특가
        </span>
      </div>

      {/* 공동구매 마감 카운트다운 */}
      {endDate && (
        <div className="mt-4 rounded-2xl px-4 py-3.5 text-white" style={{ background: "var(--accent)" }}>
          <p className="text-[11px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.75)" }}>
            공동구매 마감까지
          </p>
          <p className="text-2xl font-extrabold font-mono mt-0.5 tnum" suppressHydrationWarning>
            {remaining
              ? `${remaining.d}일 ${pad(remaining.h)}:${pad(remaining.m)}:${pad(remaining.s)}`
              : "마감되었습니다"}
          </p>
        </div>
      )}

      {/* 옵션 선택 */}
      {hasOptions && (
        <div className="mt-6">
          <p className="text-sm font-extrabold mb-2.5" style={{ color: "var(--text-primary)" }}>옵션 선택</p>
          <div className="flex flex-col gap-2">
            {setOptions!.map((opt, i) => {
              const on = selectedOpt === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedOpt(i)}
                  className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left transition-all tnum"
                  style={{
                    border: on ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                    background: on ? "var(--accent-soft)" : "#fff",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: on ? "var(--accent)" : "var(--text-primary)" }}>
                    {opt.name}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: on ? "var(--accent)" : "var(--text-secondary)" }}>
                    +{opt.price.toLocaleString()}원
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 수량 */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>수량</span>
        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center text-lg transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
            aria-label="수량 감소"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-semibold tnum" style={{ color: "var(--text-primary)" }}>
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-10 h-10 flex items-center justify-center text-lg transition-colors hover:bg-gray-50"
            style={{ color: "var(--text-secondary)" }}
            aria-label="수량 증가"
          >
            +
          </button>
        </div>
      </div>

      {/* 구매 버튼 */}
      <button
        onClick={handleBuy}
        disabled={!canBuy}
        className="w-full mt-5 py-4 rounded-2xl text-sm font-bold text-white text-center transition-all"
        style={{
          background: canBuy ? "var(--accent)" : "var(--warm-gray)",
          cursor: canBuy ? "pointer" : "not-allowed",
        }}
      >
        {buyLabel}
      </button>

      {/* 상품 상세 */}
      <div className="mt-8">
        <p className="text-sm font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>상품 상세</p>
        {description ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        ) : (
          <div
            className="rounded-2xl py-20 text-center text-sm"
            style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
          >
            상세 이미지 영역
          </div>
        )}

        {keyBenefits && keyBenefits.length > 0 && (
          <ul className="mt-4 space-y-2">
            {keyBenefits.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="mt-0.5" style={{ color: "var(--accent)" }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 리뷰 */}
      <div className="mt-8">
        <p className="text-sm font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
          리뷰 <span style={{ color: "var(--text-muted)" }}>0</span>
        </p>
        <div
          className="rounded-2xl py-12 text-center text-sm"
          style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
        >
          아직 리뷰가 없습니다
        </div>
      </div>
    </div>
  );
}

function Avatar({ inf }: { inf: Influencer }) {
  if (inf.profile_image) {
    return <img src={inf.profile_image} alt={inf.name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: "var(--accent)", color: "#fff" }}
    >
      {inf.name[0]}
    </div>
  );
}
