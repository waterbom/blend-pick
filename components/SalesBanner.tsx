"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BannerProduct {
  id: string;
  name: string;
  product_image: string | null;
  campaign_count: number;
}

/**
 * 히어로 배너 슬라이더
 *
 * 디자인 변경 포인트:
 * 1. 배경: 평평한 gray-100 → cream 그라데이션 (따뜻한 느낌)
 * 2. 타이포: font-black → font-semibold (고급스러움은 "가벼움"에서 온다)
 * 3. CTA: 검정 pill → 테라코타 라운드 버튼
 * 4. 이미지: 64x64 → 72x72 + 부드러운 그림자
 *
 * CSS 개념:
 * - linear-gradient: 두 색상 사이를 부드럽게 연결
 *   → background: linear-gradient(135deg, 크림색, 진한크림)
 * - transition-all: 모든 속성의 변화를 부드럽게 애니메이션
 * - opacity로 슬라이드 전환 → transform보다 자연스럽고 가벼움
 */
export default function SalesBanner({
  products,
}: {
  products: BannerProduct[];
}) {
  const [current, setCurrent] = useState(0);

  // 자동 슬라이드: 4초 간격 (기존 3초 → 4초, 여유로운 느낌)
  useEffect(() => {
    if (products.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % products.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [products.length]);

  if (!products.length) return null;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: 460,
        /* 135deg = 왼쪽위→오른쪽아래 방향 그라데이션 */
        background: "linear-gradient(135deg, var(--cream) 0%, var(--cream-dark) 100%)",
      }}
    >
      {/* 슬라이드 */}
      {products.map((p, i) => (
        <Link
          key={p.id}
          href={`/campaigns/${p.id}`}
          className={`absolute inset-0 flex items-center justify-center gap-20 lg:gap-40 px-8 lg:px-20 transition-all duration-1000 ease-in-out ${
            i === current ? "opacity-100 scale-100" : "opacity-0 scale-[0.98] pointer-events-none"
          }`}
        >
          {/* 왼쪽 — 텍스트 */}
          <div className="flex flex-col justify-center max-w-md">
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: "var(--accent)" }}
            >
              POPULAR NOW
            </p>
            <h2
              className="text-3xl lg:text-4xl font-semibold leading-tight mb-4 tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {p.name}
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              지금 가장 많은 캠페인이 연결된 핫한 상품
            </p>
            <span
              className="inline-flex items-center gap-2 text-sm font-medium text-white px-6 py-3 rounded-full w-fit transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
              style={{ background: "var(--accent)" }}
            >
              자세히 보기
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </div>

          {/* 오른쪽 — 이미지 */}
          <div className="w-72 h-72 shrink-0 rounded-3xl overflow-hidden" style={{ boxShadow: "var(--card-shadow-hover)" }}>
            {p.product_image ? (
              <img
                src={p.product_image}
                alt={p.name}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-6xl"
                style={{ background: "var(--cream-dark)", color: "var(--text-muted)" }}
              >
                📦
              </div>
            )}
          </div>
        </Link>
      ))}

      {/* 인디케이터 — 하단 중앙 */}
      {products.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i === current ? 28 : 12,
                background: i === current ? "var(--accent)" : "var(--warm-gray-dark)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
