"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import FallbackImg from "@/components/FallbackImg";

interface CollabProduct {
  id: string;
  name: string;
  brand: string;
  product_image: string | null;
}

/**
 * 협업 가능 제품 — 무한 컨베이어 벨트
 *
 * 핵심 구현:
 * 1. 아이템을 2배로 복제 → [...products, ...products]
 * 2. requestAnimationFrame으로 매 프레임 translateX 이동
 * 3. 전체 너비의 절반을 지나면 → x = 0으로 리셋 (이음새 없는 루프)
 * 4. mouseenter 시 멈춤, mouseleave 시 재개
 *
 * 디자인 변경:
 * - 카드: border → shadow + 큰 radius
 * - 배경: gray-50 → cream-dark (따뜻함)
 * - 좌우 fade: gray-50 → cream-dark으로 매치
 * - 숫자 뱃지: skew → pill 형태
 */
export default function CollabSection({
  products,
  totalCount,
}: {
  products: CollabProduct[];
  totalCount: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const doubled = [...products, ...products];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let animId: number;
    let x = 0;
    const speed = 0.4; // 기존 0.5 → 0.4 (더 느리게 = 더 여유로운 느낌)
    const totalWidth = track.scrollWidth / 2;

    function step() {
      x += speed;
      if (x >= totalWidth) x = 0;
      track!.style.transform = `translateX(-${x}px)`;
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);

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
    <section className="py-16 sm:py-20 overflow-hidden" style={{ background: "var(--surface-soft)" }}>
      {/* 헤더 */}
      <div className="container-blend mb-10 sm:mb-12">
        <p
          className="text-[11px] font-bold tracking-[0.22em] uppercase mb-3"
          style={{ color: "var(--accent)" }}
        >
          BLEND PICK x BRAND
        </p>
        <h2
          className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          지금 협업 가능한 제품들
        </h2>
        <div className="mt-3 h-0.5 w-12 rounded-full" style={{ background: "var(--accent)" }} />
      </div>

      {/* 컨베이어 벨트 */}
      <div className="relative">
        {/* 좌우 페이드 — 배경색과 동일한 그라데이션으로 자연스럽게 사라지는 효과 */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, var(--cream-dark), transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, var(--cream-dark), transparent)" }} />

        <div className="overflow-hidden">
          <div ref={trackRef} className="flex gap-5 will-change-transform" style={{ width: "max-content" }}>
            {doubled.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="shrink-0 w-44 rounded-2xl overflow-hidden group cursor-default transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: "#fff",
                  boxShadow: "var(--card-shadow)",
                }}
              >
                <div className="aspect-square overflow-hidden" style={{ background: "var(--cream)" }}>
                  <FallbackImg
                    src={p.product_image}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase truncate"
                    style={{ color: "var(--accent)" }}>
                    {p.brand}
                  </p>
                  <p className="text-xs font-medium line-clamp-2 leading-snug mt-1"
                    style={{ color: "var(--text-primary)" }}>
                    {p.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 홍보 문구 */}
      <div className="container-blend mt-14 sm:mt-16 text-center">
        <p className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
          현재{" "}
          <span
            className="inline-block px-3 py-1 rounded-full text-white mx-1"
            style={{ background: "var(--accent)" }}
          >
            {totalCount.toLocaleString()}
          </span>
          {" "}개의 제품들과 협업 해보세요!
        </p>
        <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
          블렌드픽과 함께라면 당신의 제품도 핫딜이 될 수 있어요
        </p>
        <Link
          href="/blend-picked"
          className="inline-flex items-center gap-2 mt-8 text-sm font-medium text-white px-6 py-3 rounded-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
          style={{ background: "var(--accent)" }}
        >
          인플루언서로 참여하기
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
