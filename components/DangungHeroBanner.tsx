"use client";

import { useState, useEffect, useRef } from "react";

const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/**
 * 단궁 페이지 첫 섹션 — /hotel 히어로와 같은 방식의 풀블리드 슬라이드 배너.
 * 각 슬라이드는 사진 여러 장을 가로로 균등 분할(object-cover)하고 문구를 얹는다.
 * 사진은 public/hotel/에 넣으면 되고, 없으면 grad 배경이 대신 보인다.
 * 높이는 페이지의 .dg-hero (뷰포트 − 헤더) — 진입 시 화면 꽉 참.
 */
const SLIDES = [
  {
    // 1번 — 브랜드: 한옥·정원 3장 가로 분할
    images: ["/hotel/dangung1.jpg", "/hotel/dangung2.jpg", "/hotel/dangung3.jpg"],
    grad: "linear-gradient(180deg,#BFE3F5 0%,#7EB8DA 46%,#7FB98B 100%)",
    tag: "PENSION · 공동구매 — 오직 블랜드픽에서만",
    title: "단궁 X 블랜드픽",
    // 사진의 하늘·잔디에서 딴 하늘색 → 초록 그라데이션
    titleGrad: "linear-gradient(115deg, #EAF6FF 0%, #BFE3F5 34%, #D9F0DC 62%, #9ED0A8 100%)",
    subtitle: "한옥과 넓은 잔디 정원 — 독채 & 파티룸 공동구매",
  },
  {
    // 2번 — 사계절: 계절 사진 4장 가로 분할
    images: ["/hotel/dangung4.jpg", "/hotel/dangung5.jpg", "/hotel/dangung6.jpg", "/hotel/dangung7.jpg"],
    grad: "linear-gradient(135deg,#9ED0A8 0%,#4E8F5C 40%,#C98A4B 75%,#BFD8E8 100%)",
    tag: "FOUR SEASONS · 사계절의 단궁",
    title: "봄부터 겨울까지,\n계절이 머무는 정원",
    // 봄 연두 → 여름 초록 → 가을 앰버 → 겨울 눈빛
    titleGrad: "linear-gradient(100deg, #CDEBB4 0%, #7FBF8A 34%, #E8B45C 66%, #DCEBF5 100%)",
    subtitle: "꽃 피는 봄, 짙푸른 여름, 물드는 가을, 고요한 겨울 — 언제 와도 다른 단궁",
  },
];

const DURATION = 5000;

export default function DangungHeroBanner() {
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
    <section className="dg-hero relative w-full overflow-hidden">
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
          {/* 사진 — 가로 균등 분할 (없으면 grad 배경) */}
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
          {/* 가독성용 얇은 베일 */}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(10,30,50,.22) 0%, rgba(10,30,50,.06) 40%, rgba(16,38,24,.32) 100%)" }} />
          {/* 미세 그레인 — 업스케일 뭉개짐을 필름 질감으로 */}
          <div className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,.02) 0 1px, transparent 1px 3px)," +
                "repeating-linear-gradient(-45deg, rgba(0,0,0,.025) 0 1px, transparent 1px 3px)",
              mixBlendMode: "overlay",
            }} />

          {/* 문구 — 중앙 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
            <div className={i === 0 ? "dg-fade dg-d1" : ""}>
              <div className="text-[10px] lg:text-[12px] mb-4 lg:mb-5"
                style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".34em", color: "rgba(255,255,255,.92)" }}>
                {slide.tag}
              </div>
            </div>
            <h2 className={`m-0 whitespace-pre-line text-[34px] lg:text-[64px] leading-[1.2] ${i === 0 ? "dg-fade dg-d2" : ""}`}
              style={{
                fontFamily: SERIF,
                fontWeight: 700,
                backgroundImage: slide.titleGrad,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 2px 14px rgba(12,36,52,.45))",
              }}>
              {slide.title}
            </h2>
            <p className={`mt-4 lg:mt-5 text-[13px] lg:text-[16px] ${i === 0 ? "dg-fade dg-d3" : ""}`}
              style={{ color: "rgba(255,255,255,.9)", textShadow: "0 1px 10px rgba(12,36,52,.4)" }}>
              {slide.subtitle}
            </p>
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
    </section>
  );
}
