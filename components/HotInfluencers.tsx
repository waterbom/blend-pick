"use client";

import { useState } from "react";

interface Influencer {
  id: string;
  name: string;
  platform: string;
  handle: string;
  followers: number;
  categories: string[] | null;
  profile_image: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  blog: "Blog",
  naver: "Naver",
};

function formatFollowers(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

export default function HotInfluencers({
  influencers,
}: {
  influencers: Influencer[];
}) {
  const VISIBLE = 10; // 2행 × 5열
  const [start, setStart] = useState(0);

  const visible = influencers.slice(start, start + VISIBLE);
  const canPrev = start > 0;
  const canNext = start < influencers.length - VISIBLE;

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-baseline gap-3 mb-10">
        <h2 className="text-2xl font-black">HOT 인플루언서</h2>
        <span className="text-xs text-orange-500 font-bold animate-pulse">
          LIVE
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* 이전 버튼 */}
        <button
          onClick={() => setStart((s) => Math.max(0, s - 1))}
          disabled={!canPrev}
          className="text-7xl text-gray-900 disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ‹
        </button>

        {/* 카드 5열 2행 */}
        <div className="flex-1 grid grid-cols-5 gap-x-5 gap-y-8" style={{ minHeight: "280px" }}>
          {visible.map((inf) => (
            <div
              key={inf.id}
              className="flex flex-col items-center text-center group h-44"
            >
              {/* 프로필 이미지 */}
              <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden mb-3 ring-2 ring-transparent group-hover:ring-orange-400 transition-all">
                {inf.profile_image ? (
                  <img
                    src={inf.profile_image}
                    alt={inf.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">
                    👤
                  </div>
                )}
              </div>

              {/* 이름 */}
              <p className="font-bold text-sm text-gray-900 mb-0.5">
                {inf.name}
              </p>

              {/* 플랫폼 + 팔로워 */}
              <p className="text-xs text-gray-400 mb-2">
                {PLATFORM_LABEL[inf.platform] ?? inf.platform} ·{" "}
                {formatFollowers(inf.followers)}
              </p>

              {/* 카테고리 태그 */}
              {inf.categories && inf.categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {inf.categories.slice(0, 2).map((cat) => (
                    <span
                      key={cat}
                      className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={() =>
            setStart((s) => Math.min(influencers.length - VISIBLE, s + 1))
          }
          disabled={!canNext}
          className="text-7xl text-gray-900 disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ›
        </button>
      </div>
    </section>
  );
}
