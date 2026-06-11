"use client";

import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";
import FallbackImg from "@/components/FallbackImg";

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

function isClosingToday(endsAt: string | null): boolean {
  if (!endsAt) return false;
  const end = new Date(endsAt);
  const now = new Date();
  return (
    end.getFullYear() === now.getFullYear() &&
    end.getMonth() === now.getMonth() &&
    end.getDate() === now.getDate()
  );
}

function ActiveCard({ page }: { page: CampaignPage }) {
  const discount =
    page.original_price && page.price
      ? Math.round((1 - page.price / page.original_price) * 100)
      : null;
  const isSoldOut = page.stock_quantity !== null && page.stock_quantity <= 0;
  const closingToday = isClosingToday(page.ends_at);

  return (
    <Link
      href={`/campaigns/${page.product_id}`}
      className="group block shrink-0 w-52 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background: "#2a2420",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.35)";
      }}
    >
      {/* 이미지 */}
      <div className="relative aspect-square overflow-hidden">
        <FallbackImg
          src={page.main_image}
          alt={page.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* 오늘 마감 뱃지 */}
        {closingToday && !isSoldOut && (
          <div
            className="absolute top-3 left-3 text-white text-[10px] font-bold px-2 py-1 rounded-md tracking-wide"
            style={{ background: "#c4765b" }}
          >
            오늘 마감
          </div>
        )}

        {/* Sold Out */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-[0.15em] uppercase border border-white/50 px-3 py-1 rounded-full">
              Sold Out
            </span>
          </div>
        )}

        {/* 공구 수 or 단독 뱃지 (오른쪽 상단) */}
        {!closingToday && page.campaign_count && page.campaign_count > 1 ? (
          <div
            className="absolute top-3 right-3 text-white text-[10px] font-bold px-2 py-1 rounded-md"
            style={{ background: "rgba(196,118,91,0.9)" }}
          >
            {page.campaign_count}개 공구
          </div>
        ) : null}
      </div>

      {/* 텍스트 */}
      <div className="p-3.5">
        {page.ends_at && (
          <div className="mb-2">
            <CountdownTimer target={page.ends_at} label="마감까지" dark />
          </div>
        )}
        <p className="text-sm font-medium line-clamp-2 leading-snug mb-2" style={{ color: "#f0ece6" }}>
          {page.title}
          {page.influencer_name && (
            <span style={{ color: "#e8a990" }}> x {page.influencer_name}</span>
          )}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {discount && (
            <span className="text-xs font-bold" style={{ color: "#c4765b" }}>
              {discount}%
            </span>
          )}
          <span className="text-sm font-bold" style={{ color: "#f0ece6" }}>
            {page.price.toLocaleString()}원
          </span>
          {page.original_price && (
            <span className="text-xs line-through" style={{ color: "#6b6560" }}>
              {page.original_price.toLocaleString()}원
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomeDealSection({
  active,
}: {
  active: CampaignPage[];
  upcoming: CampaignPage[];
  ended: CampaignPage[];
}) {
  if (!active.length) return null;

  const closingCount = active.filter((p) => isClosingToday(p.ends_at)).length;

  return (
    <section style={{ background: "#1a1714" }} className="py-16">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-10 px-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-2" style={{ color: "#c4765b" }}>
            BLEND PICK
          </p>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#f0ece6" }}>
            지금 놓치면 끝{" "}
            <span style={{ color: "#c4765b" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="inline-block align-middle mb-1">
                <circle cx="12" cy="13" r="8" />
                <path strokeLinecap="round" d="M12 5V3M9 3h6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4.5l2.5 2.5" />
                <path strokeLinecap="round" d="M6.3 6.3l1 1M17.7 6.3l-1 1" />
              </svg>
            </span>
          </h2>
          {closingCount > 0 && (
            <p className="mt-1.5 text-sm" style={{ color: "#6b6560" }}>
              오늘 마감{" "}
              <span style={{ color: "#c4765b" }} className="font-semibold">
                {closingCount}개
              </span>
            </p>
          )}
        </div>
        <Link
          href="/campaigns"
          className="text-sm transition-opacity duration-200 hover:opacity-70 mb-1"
          style={{ color: "#6b6560" }}
        >
          전체보기 →
        </Link>
      </div>

      {/* 카드 리스트 */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-5 px-8 pb-2">
          {active.map((page) => (
            <ActiveCard key={page.id} page={page} />
          ))}
        </div>
      </div>
    </section>
  );
}
