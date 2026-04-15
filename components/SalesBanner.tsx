"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BannerProduct {
  id: string;
  name: string;
  product_image: string | null;
  campaign_count: number;
}

export default function SalesBanner({
  products,
}: {
  products: BannerProduct[];
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % products.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [products.length]);

  if (!products.length) return null;

  return (
    <div
      className="relative w-full bg-gray-100 mb-8 overflow-hidden"
      style={{ height: 420 }}
    >
      {/* 슬라이드 */}
      {products.map((p, i) => (
        <Link
          key={p.id}
          href={`/products/${p.id}`}
          className={`absolute inset-0 flex items-center justify-center gap-60 px-16 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* 왼쪽 — 텍스트 */}
          <div className="flex flex-col justify-center text-gray-900 max-w-sm">
            <p className="text-xs font-semibold tracking-widest text-orange-500 uppercase mb-3">
              🔥 인기 공구
            </p>
            <h2 className="text-3xl font-black leading-tight mb-3">{p.name}</h2>
            <p className="text-sm text-gray-500 mb-8">
              지금 가장 많은 캠페인이 연결된 핫한 상품
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-white bg-black px-5 py-2.5 rounded-full w-fit hover:bg-gray-800 transition-colors">
              지금 보러가기 →
            </span>
          </div>

          {/* 오른쪽 — 이미지 */}
          <div className="w-64 h-64 shrink-0">
            {p.product_image ? (
              <img
                src={p.product_image}
                alt={p.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">
                📦
              </div>
            )}
          </div>
        </Link>
      ))}

      {/* 인디케이터 */}
      {products.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === current ? "bg-orange-400 w-6" : "bg-white/30 w-3"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
