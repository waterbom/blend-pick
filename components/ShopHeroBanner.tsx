"use client";

import { useState, useEffect, useRef } from "react";

const SLIDES = [
  { image: "/banner-1.jpeg", href: "/products" },
  { image: "/banner-2.jpeg", href: "/products" },
  { image: "/banner-3.jpeg", href: "/products" },
];

const DURATION = 4000;

export default function ShopHeroBanner() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, current]);

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className="transition-opacity duration-1000"
          style={{
            position: i === current ? "relative" : "absolute",
            inset: 0,
            opacity: i === current ? 1 : 0,
            pointerEvents: i === current ? "auto" : "none",
          }}
        >
          <img
            src={slide.image}
            alt=""
            style={{ width: "100%", height: "auto", display: "block" }}
            draggable={false}
          />
        </div>
      ))}

      {/* 인디케이터 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setCurrent(i); }}
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: i === current ? 28 : 12,
              background: i === current ? "#2D5A27" : "rgba(45,90,39,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
