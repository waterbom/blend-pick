"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import FallbackImg from "@/components/FallbackImg";

export interface CarouselProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  sold_out: boolean;
}

/**
 * 상품 패럴랙스 캐러셀 — 라이브러리 없이 스크롤 스냅 + 소량의 JS.
 * 가운데 카드는 크고 선명하게, 양옆 카드는 살짝 보이며 작고 어둡게.
 * 카드 안 이미지는 스크롤 반대 방향으로 미세하게 움직여(패럴랙스) 깊이감을 준다.
 * 스와이프(모바일)·드래그 스크롤·화살표·점 페이지네이션 모두 지원.
 */
export default function ProductCarousel({ products }: { products: CarouselProduct[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  // 스크롤 위치 기준으로 각 슬라이드의 "중앙에서 얼마나 떨어졌나"를 계산해
  // 크기·밝기(--dist)와 이미지 패럴랙스 이동을 갱신
  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestAbs = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const d = el.offsetLeft + el.offsetWidth / 2 - center; // 중앙과의 부호 있는 거리
      const abs = Math.abs(d);
      if (abs < bestAbs) { bestAbs = abs; best = i; }
      el.style.setProperty("--dist", String(Math.min(1, abs / el.offsetWidth)));
      const img = el.querySelector<HTMLElement>(".pc-img");
      if (img) img.style.transform = `translateX(${(-d / el.offsetWidth) * 7}%) scale(1.14)`;
    });
    setIdx(best);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      track.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function goto(i: number) {
    const track = trackRef.current;
    const el = track?.children[i] as HTMLElement | undefined;
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }

  if (products.length === 0) return null;

  return (
    <section className="relative" aria-label="상품 캐러셀">
      <style>{`
        .pc-track { scrollbar-width: none; -ms-overflow-style: none; }
        .pc-track::-webkit-scrollbar { display: none; }
        .pc-slide {
          transform: scale(calc(1 - var(--dist, 0) * 0.06));
          filter: brightness(calc(1 - var(--dist, 0) * 0.35));
          transition: transform .15s linear, filter .15s linear;
        }
      `}</style>

      <div
        ref={trackRef}
        className="pc-track flex overflow-x-auto gap-4 lg:gap-6 pb-2"
        style={{
          scrollSnapType: "x mandatory",
          // 첫·마지막 카드도 정중앙에 올 수 있게 좌우 패딩 확보
          paddingInline: "max(16px, calc((100% - min(72vw, 640px)) / 2))",
        }}
      >
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}`}
            className="pc-slide relative shrink-0 overflow-hidden"
            style={{
              width: "min(72vw, 640px)",
              aspectRatio: "4 / 3",
              minHeight: "280px",
              maxHeight: "500px",
              scrollSnapAlign: "center",
              background: "#F6F4EE",
              boxShadow: "0 18px 44px rgba(28,36,24,.18)",
            }}
          >
            {/* 배경: 같은 사진을 흐리게 채워 여백을 메움 — 패럴랙스는 이 층에만 */}
            <div className="pc-img absolute inset-0 will-change-transform" aria-hidden>
              {p.main_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.main_image} alt="" className="w-full h-full object-cover"
                  style={{ filter: "blur(22px) brightness(.82) saturate(1.05)" }} />
              )}
            </div>
            {/* 전경: 원본 비율 그대로 (자르지 않음) — 아래 정보 오버레이 영역만큼 여백 */}
            <div className="absolute inset-0" style={{ padding: "12px 12px 88px" }}>
              <FallbackImg src={p.main_image} alt={p.name} className="w-full h-full object-contain" />
            </div>

            {/* 하단 정보 오버레이 */}
            <div className="absolute inset-x-0 bottom-0 p-5 lg:p-7"
              style={{ background: "linear-gradient(180deg, rgba(20,26,17,0) 0%, rgba(20,26,17,.62) 45%, rgba(20,26,17,.82) 100%)" }}>
              <p className="m-0 text-[10px] lg:text-[11px] font-semibold" style={{ letterSpacing: ".2em", color: "#C7D6C0" }}>
                {p.brand}
              </p>
              <p className="m-0 mt-1 text-[17px] lg:text-[24px] font-bold leading-snug line-clamp-2 text-white">
                {p.name}
              </p>
              <div className="mt-2 lg:mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="m-0 tnum">
                  <span className="text-[16px] lg:text-[20px] font-bold text-white">{p.price.toLocaleString()}원</span>
                  {p.original_price && p.original_price > p.price && (
                    <span className="ml-2 text-[12px] lg:text-[13px] line-through" style={{ color: "rgba(255,255,255,.55)" }}>
                      {p.original_price.toLocaleString()}원
                    </span>
                  )}
                </p>
                <span className="text-[12px] lg:text-[13px] font-bold px-4 lg:px-5 py-2 lg:py-2.5"
                  style={p.sold_out
                    ? { background: "rgba(255,255,255,.18)", color: "rgba(255,255,255,.75)" }
                    : { background: "#fff", color: "#1C2418" }}>
                  {p.sold_out ? "품절" : "구매하기 →"}
                </span>
              </div>
            </div>

            {p.sold_out && (
              <span className="absolute top-4 left-4 px-3 py-1.5 text-[11px] font-bold"
                style={{ background: "rgba(28,36,24,.85)", color: "#FDFCF9", letterSpacing: ".2em" }}>
                품 절
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* 화살표 — 데스크톱만 */}
      {products.length > 1 && (
        <>
          <button aria-label="이전 상품" onClick={() => goto(Math.max(0, idx - 1))}
            className="hidden lg:flex absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center transition-opacity"
            style={{ background: "rgba(255,255,255,.92)", boxShadow: "0 4px 14px rgba(28,36,24,.18)", opacity: idx === 0 ? 0.35 : 1 }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#1C2418" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button aria-label="다음 상품" onClick={() => goto(Math.min(products.length - 1, idx + 1))}
            className="hidden lg:flex absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center transition-opacity"
            style={{ background: "rgba(255,255,255,.92)", boxShadow: "0 4px 14px rgba(28,36,24,.18)", opacity: idx === products.length - 1 ? 0.35 : 1 }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#1C2418" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* 점 페이지네이션 */}
      {products.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {products.map((p, i) => (
            <button key={p.id} aria-label={`${i + 1}번째 상품으로`} onClick={() => goto(i)}
              className="transition-all duration-200"
              style={{
                width: i === idx ? "22px" : "7px",
                height: "7px",
                borderRadius: "99px",
                background: i === idx ? "#244B1F" : "#D6D6CF",
              }} />
          ))}
        </div>
      )}
    </section>
  );
}
