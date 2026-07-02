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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, DURATION);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  return (
    <div
      className="relative w-full max-w-[2400px] mx-auto overflow-hidden"
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
              background: i === current ? "var(--accent)" : "rgba(45,90,39,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
