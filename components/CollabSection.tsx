"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface CollabProduct {
  id: string;
  name: string;
  brand: string;
  product_image: string | null;
}

export default function CollabSection({
  products,
  totalCount,
}: {
  products: CollabProduct[];
  totalCount: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  // 무한 스크롤: 아이템 복제해서 이어붙이기
  const doubled = [...products, ...products];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let animId: number;
    let x = 0;
    const speed = 0.5;
    const totalWidth = track.scrollWidth / 2;

    function step() {
      x += speed;
      if (x >= totalWidth) x = 0;
      track!.style.transform = `translateX(-${x}px)`;
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);

    // hover 시 멈춤
    const pause = () => cancelAnimationFrame(animId);
    const resume = () => { animId = requestAnimationFrame(step); };
    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    return () => {
      cancelAnimationFrame(animId);
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, []);

  if (!products.length) return null;

  return (
    <section className="py-16 overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="px-6 mb-10">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">
          BLEND PICK × BRAND
        </p>
        <h2 className="text-3xl font-black tracking-tight">
          지금 협업 가능한 제품들
        </h2>
      </div>

      {/* 컨베이어 벨트 */}
      <div className="relative">
        {/* 좌우 페이드 */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none" />

        <div className="overflow-hidden">
          <div ref={trackRef} className="flex gap-4 will-change-transform" style={{ width: "max-content" }}>
            {doubled.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="shrink-0 w-40 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group cursor-default"
              >
                {/* 제품 이미지 */}
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  {p.product_image ? (
                    <img
                      src={p.product_image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 text-3xl">
                      📦
                    </div>
                  )}
                </div>

                {/* 브랜드 + 제품명 */}
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-bold text-orange-500 tracking-widest uppercase truncate">
                    {p.brand}
                  </p>
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug mt-0.5">
                    {p.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 홍보 문구 */}
      <div className="px-6 mt-12 text-center">
        <p className="text-2xl font-black text-gray-900">
          현재{" "}
          <span className="relative inline-block mx-1">
            <span className="relative z-10 px-2 text-white">{totalCount.toLocaleString()}</span>
            <span className="absolute inset-0 bg-orange-500 -skew-x-6" />
          </span>
          {" "}개의 제품들과 협업 해보세요!
        </p>
        <p className="text-sm text-gray-400 mt-3">
          블렌드픽과 함께라면 당신의 제품도 핫딜이 될 수 있어요
        </p>
        <Link
          href="/blend-picked"
          className="inline-flex items-center gap-2 mt-6 text-sm font-bold text-gray-900 border-b-2 border-orange-500 pb-0.5 hover:text-orange-500 transition-colors"
        >
          인플루언서로 참여하기 →
        </Link>
      </div>
    </section>
  );
}
