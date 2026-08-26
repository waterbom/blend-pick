"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

/**
 * 호텔공구 카테고리 첫 섹션 — 풀블리드 슬라이드 배너.
 * 각 슬라이드는 사진(object-cover) 위에 어두운 스크림 + 홍보 문구를 얹어
 * "사진 안에 글씨가 박힌" 홍보 배너처럼 보이게 한다.
 * 사진은 public/hotel/에 넣으면 되고(없으면 grad 배경이 대신 보임).
 * 1번 슬라이드: 4.png / 4.1.png / 4.2.png 3장을 가로로 균등 분할해 한 화면에 표시.
 * 2번 슬라이드: 5.png / 5.1.png / 5.2.png 3장(요트체험·아쿠아리움·여수야시장)을 가로로 균등 분할.
 */
const SLIDES = [
  {
    // 단궁 브랜드 (한옥·정원 3장 가로) — 다음 공구, 맨 앞에
    images: ["/hotel/dangung1.jpg", "/hotel/dangung2.jpg", "/hotel/dangung3.jpg"],
    grad: "linear-gradient(180deg,#7EB8DA,#7FB98B)",
    tag: "단궁 펜션 · 독채 & 파티룸",
    title: "단궁 X 블랜드픽\n펜션 공동구매",
    subtitle: "한옥과 넓은 잔디 정원 — 오픈 준비 중",
    href: "/hotel/dangung",
    cta: "단궁 공구 미리 보기",
  },
  {
    // 단궁 사계절 (봄/여름/가을/겨울 4장 가로)
    images: ["/hotel/dangung4.jpg", "/hotel/dangung5.jpg", "/hotel/dangung6.jpg", "/hotel/dangung7.jpg"],
    grad: "linear-gradient(135deg,#9ED0A8,#4E8F5C)",
    tag: "사계절의 단궁",
    title: "봄부터 겨울까지,\n계절이 머무는 정원",
    subtitle: "꽃 피는 봄, 짙푸른 여름, 물드는 가을, 고요한 겨울",
    href: "/hotel/dangung",
    cta: "단궁 공구 미리 보기",
  },
  {
    // 4png 구성 (객실/스위트 3장 가로) — UTOP (공구 마감)
    images: ["/hotel/4.png", "/hotel/4.1.png", "/hotel/4.2.png"],
    grad: "linear-gradient(135deg,#16324f,#2b5f7d)",
    tag: "여수 엑스포 · UTOP 마리나",
    title: "오션뷰 리조트\n단독 공동구매",
    subtitle: "블랜드픽만의 특가로 만나는 프리미엄 스테이 — 이번 공구는 마감됐어요",
    href: "/hotel/utop",
    cta: "공구 상세 보기",
  },
  {
    // 여수 볼거리 홍보 (요트체험/아쿠아리움/여수야시장 3장 가로)
    images: ["/hotel/5.png", "/hotel/5.1.png", "/hotel/5.2.png"],
    grad: "linear-gradient(135deg,#155f4f,#2b7d63)",
    tag: "여수 여행",
    title: "호텔 외에도\n다양한 여수의 볼거리들!",
    subtitle: "요트체험 · 아쿠아리움 · 여수야시장까지, 여수를 통째로",
    href: "/hotel/utop",
    cta: "공구 상세 보기",
  },
];

const DURATION = 4500;

export default function HotelHeroBanner() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-screen w-full">
        {SLIDES.map((slide, i) => (
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {SLIDES.map((_, i) => (
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
      </div>
    </section>
  );
}
