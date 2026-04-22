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

function ActiveCard({ page }: { page: CampaignPage }) {
  const discount =
    page.original_price && page.price
      ? Math.round((1 - page.price / page.original_price) * 100)
      : null;
  const isSoldOut = page.stock_quantity !== null && page.stock_quantity <= 0;

  return (
    <Link href={`/products/${page.product_id}`} className="group block shrink-0 w-52">
      <div className="relative aspect-square bg-gray-50 overflow-hidden mb-3">
        {page.main_image ? (
          <img
            src={page.main_image}
            alt={page.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-4xl">
            📦
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-widest">sold out</span>
          </div>
        )}
        {page.campaign_count && page.campaign_count > 1 ? (
          <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {page.campaign_count}개 공구
          </div>
        ) : page.influencer_name ? (
          <div className="absolute top-2 right-2 bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full">
            단독!
          </div>
        ) : null}
      </div>

      {page.ends_at && (
        <div className="mb-1.5">
          <CountdownTimer target={page.ends_at} label="⏰ 종료까지" />
        </div>
      )}

      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
        {page.title}
        {page.influencer_name && (
          <span className="text-orange-500"> X {page.influencer_name}</span>
        )}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {page.original_price && (
          <span className="text-xs text-gray-300 line-through">
            {page.original_price.toLocaleString()}원
          </span>
        )}
        {discount && (
          <span className="text-xs font-bold text-red-500">{discount}%</span>
        )}
        <span className="text-sm font-bold text-gray-900">
          {page.price.toLocaleString()}원
        </span>
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

  return (
    <section className="py-16">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-10 px-6">
        <div>
          <p className="text-xs font-bold tracking-widest text-orange-500 uppercase mb-2">
            BLEND PICK
          </p>
          <h2 className="text-5xl font-black tracking-tighter leading-none flex items-center gap-2">
            <span className="relative inline-block">
              <span className="relative z-10 text-white px-2">HOT</span>
              <span className="absolute inset-0 bg-gray-900 -skew-x-6" />
            </span>
            <span className="relative inline-block">
              <span className="relative z-10 text-white px-2">DEAL</span>
              <span className="absolute inset-0 bg-orange-500 -skew-x-6" />
            </span>
            <span className="text-orange-500">!</span>
          </h2>
        </div>
        <Link
          href="/products"
          className="text-sm text-gray-400 hover:text-black transition-colors mb-1"
        >
          전체보기 →
        </Link>
      </div>

      {/* 가로 스크롤 */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-5 px-6 pb-2">
          {active.map((page) => (
            <ActiveCard key={page.id} page={page} />
          ))}
        </div>
      </div>
    </section>
  );
}
