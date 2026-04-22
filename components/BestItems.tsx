"use client";

import { useState } from "react";
import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";

interface CampaignPage {
  id: string;
  product_id: string;
  title: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  stock_quantity: number | null;
}

interface Props {
  pages: CampaignPage[];
  title: string;
  timerLabel: string;
  timerKey: "ends_at" | "starts_at";
  dim?: boolean;
}

export default function BestItems({ pages, title, timerLabel, timerKey, dim }: Props) {
  const [start, setStart] = useState(0);
  const VISIBLE = 3;
  const visible = pages.slice(start, start + VISIBLE);

  const prev = () => setStart((s) => Math.max(0, s - 1));
  const next = () => setStart((s) => Math.min(pages.length - VISIBLE, s + 1));

  const canPrev = start > 0;
  const canNext = start < pages.length - VISIBLE;

  if (!pages.length) return null;

  return (
    <section className={`max-w-6xl mx-auto px-6 py-16 ${dim ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-black">{title}</h2>
        <Link
          href="/products"
          className="text-sm text-gray-400 hover:text-black transition-colors"
        >
          더보기 →
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={prev}
          disabled={!canPrev}
          className="text-7xl text-gray-900 transition-colors disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ‹
        </button>

        <div className="flex-1 grid grid-cols-3 gap-6">
          {visible.map((page, idx) => {
            const rank = start + idx + 1;
            const discount = page.original_price
              ? Math.round((1 - page.price / page.original_price) * 100)
              : null;
            const isSoldOut =
              page.stock_quantity !== null && page.stock_quantity <= 0;
            const timerTarget = page[timerKey];

            return (
              <Link
                key={page.id}
                href={`/products/${page.product_id}`}
                className="group block"
              >
                <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden mb-3">
                  <span className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center z-10">
                    {rank}
                  </span>

                  {page.main_image ? (
                    <img
                      src={page.main_image}
                      alt={page.title}
                      className={`w-full h-full object-cover transition-transform duration-300 ${dim ? "" : "group-hover:scale-105"}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 text-4xl">
                      📦
                    </div>
                  )}

                  {isSoldOut && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-sm font-bold tracking-widest">
                        sold out
                      </span>
                    </div>
                  )}
                </div>

                {timerTarget && !dim && (
                  <div className="mb-2">
                    <CountdownTimer target={timerTarget} label={timerLabel} />
                  </div>
                )}

                <p className="text-sm font-bold text-gray-900 line-clamp-2 mb-1 leading-snug">
                  {page.title}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {page.original_price && (
                    <span className="text-xs text-gray-300 line-through">
                      {page.original_price.toLocaleString()}원
                    </span>
                  )}
                  {discount && !dim && (
                    <span className="text-sm font-bold text-red-500">
                      {discount}%
                    </span>
                  )}
                  <span className="font-bold text-sm">
                    {page.price.toLocaleString()}원
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <button
          onClick={next}
          disabled={!canNext}
          className="text-7xl text-gray-900 transition-colors disabled:opacity-20 select-none w-14 shrink-0 leading-none"
        >
          ›
        </button>
      </div>

      {pages.length > VISIBLE && (
        <div className="mt-10 flex justify-center">
          <div className="flex gap-1.5">
            {Array.from({ length: pages.length - VISIBLE + 1 }).map((_, i) => (
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
      )}
    </section>
  );
}
