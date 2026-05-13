"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  brand: string;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

const SLIDE_DURATION = 2000;

export default function HeroBanner({ products }: { products: Product[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(SLIDE_DURATION);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 슬라이드 이동 예약
  const scheduleNext = (delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startTimeRef.current = Date.now();
    remainingRef.current = delay;
    timerRef.current = setTimeout(() => {
      setCurrent((c) => (c + 1) % products.length);
    }, delay);
  };

  // 슬라이드 바뀔 때 새로 예약
  useEffect(() => {
    scheduleNext(SLIDE_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, products.length]);

  const handleMouseEnter = () => {
    setPaused(true);
    // 남은 시간 계산 후 타이머 멈춤
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    setPaused(false);
    // 남은 시간부터 재시작
    scheduleNext(remainingRef.current);
  };

  const product = products[current];

  return (
    <section
      className="relative bg-gray-50 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="max-w-6xl mx-auto px-6 py-20 flex items-center justify-between min-h-[420px]">
        {/* 왼쪽 텍스트 */}
        <div className="max-w-md">
          <p className="text-xs text-gray-400 mb-3 tracking-widest uppercase">{product.brand}</p>
          <h1 className="text-3xl font-black leading-tight mb-4 text-gray-900">
            {product.name}
          </h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            인플루언서와 벤더사가 함께 기획한<br />
            검증된 공동구매 상품을 만나보세요.
          </p>
          <Link
            href={`/campaigns/${product.id}`}
            className="inline-block bg-black text-white text-sm font-medium px-6 py-3 hover:bg-gray-800 transition-colors"
          >
            상품 보기
          </Link>
        </div>

        {/* 오른쪽 이미지 */}
        <div className="hidden md:block w-96 h-80">
          {product.product_image && (
            <img
              key={product.id}
              src={product.product_image}
              alt={product.name}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      </div>

      {/* 슬라이드 게이지 인디케이터 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {products.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className="relative h-[2px] bg-gray-300 overflow-hidden"
            style={{ width: idx === current ? "60px" : "30px" }}
          >
            {idx === current && (
              <span
                key={current}
                className="absolute inset-y-0 left-0 bg-black"
                style={{
                  animation: `gauge ${SLIDE_DURATION}ms linear forwards`,
                  animationPlayState: paused ? "paused" : "running",
                }}
              />
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes gauge {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </section>
  );
}
