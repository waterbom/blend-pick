"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { StaySlide } from "@/lib/stay-banners";

/**
 * 숙소 배너 섹션 — 풀블리드 슬라이드 (사진 가로 균등 분할 + 스크림 + 문구 + CTA).
 * /hotel에서 숙소별로 하나씩 세로로 쌓인다. 슬라이드 내용은 lib/stay-banners.ts에서 관리 —
 * 새 숙소는 거기에 항목만 추가하면 이 배너 양식이 그대로 적용된다.
 */
const DURATION = 5000;

export default function StayBanner({ slides }: { slides: StaySlide[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length < 2) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, slides.length]);

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-screen w-full">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-[900ms] ease-out"
            style={{
              opacity: i === current ? 1 : 0,
              pointerEvents: i === current ? "auto" : "none",
              background: slide.grad,
            }}
          >
            {/* 사진 (없으면 grad 배경이 보임). 여러 장이면 가로로 균등 분할해 한 화면에 표시 */}
            <div className="absolute inset-0 flex flex-row">
              {slide.images.map((src, k) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={k}
                  src={src}
                  alt=""
                  className="h-full flex-1 min-w-0 object-cover"
                  draggable={false}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                />
              ))}
            </div>
            {/* 가독성용 스크림 */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0.12) 100%)" }}
            />

            {/* 홍보 문구 */}
            <div className="absolute inset-0 flex items-end">
              <div className="container-blend w-full pb-16 sm:pb-20 lg:pb-24">
                <div className="max-w-2xl">
                  <span
                    className="inline-block text-[11px] sm:text-xs font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full mb-4 backdrop-blur-sm"
                    style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)" }}
                  >
                    {slide.tag}
                  </span>
                  <h2 className="text-white font-extrabold leading-[1.12] tracking-tight whitespace-pre-line text-3xl sm:text-5xl lg:text-6xl"
                    style={{ textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}>
                    {slide.title}
                  </h2>
                  <p className="mt-4 text-sm sm:text-lg font-medium" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
                    {slide.subtitle}
                  </p>
                  <Link
                    href={slide.href}
                    className="inline-flex items-center gap-2 mt-7 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all hover:brightness-95"
                    style={{ background: "#fff", color: "var(--accent)" }}
                  >
                    {slide.cta}
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 인디케이터 */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`${i + 1}번째 슬라이드`}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: i === current ? 28 : 12,
                  background: i === current ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
