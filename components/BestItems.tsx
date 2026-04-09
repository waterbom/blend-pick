"use client";

import { useState } from "react";
import Link from "next/link";


interface Product {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  consumer_price: number;
  groupbuy_price: number;
  product_image: string | null;
}

export default function BestItems({ products }: { products: Product[] }) {
  const [start, setStart] = useState(0);
  const VISIBLE = 3;
  const visible = products.slice(start, start + VISIBLE);

  const prev = () => setStart((s) => Math.max(0, s - 1));
  const next = () => setStart((s) => Math.min(products.length - VISIBLE, s + 1));

  const canPrev = start > 0;
  const canNext = start < products.length - VISIBLE;

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-black mb-10">BEST ITEMS</h2>

      <div className="flex items-center gap-4">
        {/* 이전 버튼 */}
        <button
          onClick={prev}
          disabled={!canPrev}
          className="text-7xl text-gray-900 transition-colors disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ‹
        </button>

        {/* 카드 3개 */}
        <div className="flex-1 grid grid-cols-3 gap-6">
          {visible.map((product, idx) => {
            const rank = start + idx + 1;
            const hasDiscount =
              product.groupbuy_price > 0 &&
              product.groupbuy_price < product.consumer_price;
            const discountRate = hasDiscount
              ? Math.round(
                  (1 - product.groupbuy_price / product.consumer_price) * 100
                )
              : 0;

            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group block"
              >
                {/* 이미지 영역 */}
                <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden mb-3">
                  {/* 순위 뱃지 */}
                  <span className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center z-10">
                    {rank}
                  </span>

                  {product.product_image && (
                    <img
                      src={product.product_image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* 하트 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                    className="absolute bottom-3 right-3 z-10 text-xl text-gray-300 hover:text-red-400 transition-colors"
                  >
                    ♡
                  </button>
                </div>

                {/* 텍스트 영역 */}
                <p className="text-sm font-bold text-gray-900 line-clamp-2 mb-1 leading-snug">
                  {product.name}
                </p>
                {product.description && (
                  <p className="text-xs text-gray-400 line-clamp-1 mb-2">
                    {product.description}
                  </p>
                )}

                {hasDiscount ? (
                  <div>
                    <p className="text-xs text-gray-300 line-through">
                      {product.consumer_price.toLocaleString()}원
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-red-500 font-bold text-sm">
                        {discountRate}%
                      </span>
                      <span className="font-bold text-sm">
                        {product.groupbuy_price.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="font-bold text-sm">
                    {product.consumer_price.toLocaleString()}원
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={next}
          disabled={!canNext}
          className="text-7xl text-gray-900 transition-colors disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ›
        </button>
      </div>

      {/* 전체 상품 보기 */}
      <div className="text-center mt-12">
        <Link
          href="/products"
          className="inline-block border border-black text-sm font-medium px-8 py-3 hover:bg-black hover:text-white transition-colors"
        >
          전체 상품 보기
        </Link>
      </div>

      {/* 하단 인디케이터 */}
      <div className="mt-10 flex justify-center">
        <div className="flex gap-1.5">
          {Array.from({ length: products.length - VISIBLE + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStart(i)}
              className={`h-[2px] transition-all ${
                i === start ? "w-10 bg-black" : "w-4 bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
