"use client";

import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";

interface CampaignPage {
  id: string;
  product_id: string;
  title: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  stock_quantity: number | null;
  campaign_count?: number;
  influencer_name?: string | null;
}

/**
 * 상품 카드 — 고급스러운 버전
 *
 * 디자인 원칙:
 * - 카드 자체가 "떠 있는" 느낌 → box-shadow + border-radius
 * - 호버 시 살짝 위로 올라감 → transform: translateY(-4px)
 * - 이미지 호버 시 살짝 확대 → scale(1.05)
 * - 이 3가지가 합쳐지면 "살아 있는" 느낌
 */
function ActiveCard({ page }: { page: CampaignPage }) {
  const discount =
    page.original_price && page.price
      ? Math.round((1 - page.price / page.original_price) * 100)
      : null;
  const isSoldOut = page.stock_quantity !== null && page.stock_quantity <= 0;

  return (
    <Link
      href={`/products/${page.product_id}`}
      className="group block shrink-0 w-56 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "var(--card-bg, #fff)",
        boxShadow: "var(--card-shadow)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--card-shadow)";
      }}
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "var(--cream-dark)" }}>
        {page.main_image ? (
          <img
            src={page.main_image}
            alt={page.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl" style={{ color: "var(--text-muted)" }}>
            📦
          </div>
        )}

        {/* Sold Out 오버레이 — backdrop-blur로 뒤가 살짝 보임 */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-xs font-semibold tracking-[0.15em] uppercase">Sold Out</span>
          </div>
        )}

        {/* 뱃지 — 둥근 pill 형태 */}
        {page.campaign_count && page.campaign_count > 1 ? (
          <div
            className="absolute top-3 right-3 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--accent)" }}
          >
            {page.campaign_count}개 공구
          </div>
        ) : page.influencer_name ? (
          <div
            className="absolute top-3 right-3 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "var(--text-primary)" }}
          >
            단독
          </div>
        ) : null}
      </div>

      {/* 텍스트 영역 */}
      <div className="p-4">
        {page.ends_at && (
          <div className="mb-2">
            <CountdownTimer target={page.ends_at} label="마감까지" />
          </div>
        )}

        <p
          className="text-sm font-medium line-clamp-2 leading-snug mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {page.title}
          {page.influencer_name && (
            <span style={{ color: "var(--accent)" }}> x {page.influencer_name}</span>
          )}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {discount && (
            <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
              {discount}%
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {page.price.toLocaleString()}원
          </span>
          {page.original_price && (
            <span className="text-xs line-through" style={{ color: "var(--text-muted)" }}>
              {page.original_price.toLocaleString()}원
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * HOT DEAL 섹션
 *
 * 기존: "HOT DEAL!" 텍스트에 -skew-x-6 배경 → 떨이 세일 느낌
 * 변경: 깔끔한 타이포 + 하단 액센트 라인 → 프리미엄 느낌
 *
 * 레이아웃 개념:
 * - overflow-x-auto: 가로 스크롤 가능
 * - scrollbar-hide: 스크롤바는 숨기되 터치/마우스 휠로 스크롤 가능
 * - shrink-0: flex 아이템이 줄어들지 않게 (카드 크기 유지)
 */
export default function HomeDealSection({
  active,
}: {
  active: CampaignPage[];
  upcoming: CampaignPage[];
  ended: CampaignPage[];
}) {
  if (!active.length) return null;

  return (
    <section className="py-20">
      {/* 섹션 헤더 */}
      <div className="flex items-end justify-between mb-12 px-8">
        <div>
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            BLEND PICK
          </p>
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Hot Deal
          </h2>
          {/* 액센트 라인 — skew 배경 대신 심플한 라인으로 고급감 */}
          <div
            className="mt-3 h-0.5 w-12 rounded-full"
            style={{ background: "var(--accent)" }}
          />
        </div>
        <Link
          href="/products"
          className="text-sm transition-colors duration-200 mb-1"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          전체보기 →
        </Link>
      </div>

      {/* 가로 스크롤 카드 리스트 */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-6 px-8 pb-4">
          {active.map((page) => (
            <ActiveCard key={page.id} page={page} />
          ))}
        </div>
      </div>
    </section>
  );
}
