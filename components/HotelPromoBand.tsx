"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SALE_START, GROUPBUY_DEADLINE } from "@/lib/hotel";

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SERIF = "'Noto Serif KR', serif";
const pad = (n: number) => String(n).padStart(2, "0");

// PRODUCTS 하단 "진행 중 공구" 밴드 — 호텔 공구 라이브 카운트다운 + 예약 페이지 연결
export default function HotelPromoBand() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sale: "before" | "open" | "closed" =
    now < new Date(SALE_START).getTime() ? "before"
    : now > new Date(GROUPBUY_DEADLINE).getTime() ? "closed" : "open";
  const diff = Math.max(0, new Date(sale === "before" ? SALE_START : GROUPBUY_DEADLINE).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 p-6 lg:py-7 lg:px-9"
      style={{ background: "#244B1F", color: "#EAF0E6" }}>
      <div>
        <div className="text-[10px] mb-2" style={{ fontFamily: MONO, fontWeight: 500, letterSpacing: ".28em", color: "#9FBF93" }}>
          지금 진행 중
        </div>
        <div className="text-[17px] lg:text-[20px]" style={{ fontFamily: SERIF, fontWeight: 600, color: "#fff" }}>
          호텔공구 × 여수 UTOP 마리나 호텔
        </div>
        <div className="mt-1.5 text-[12px] lg:text-[13px]" style={{ color: "#C7D6C0" }} suppressHydrationWarning>
          {sale === "closed" ? (
            "이번 공구가 마감되었습니다"
          ) : (
            <>
              오션뷰 객실 · 조식 · 인피니티풀 포함, {sale === "before" ? "판매 시작까지" : "판매 종료까지"}{" "}
              <span style={{ fontFamily: MONO, fontWeight: 600, color: "#E9C46A" }}>
                {d}일 {pad(h)}:{pad(m)}:{pad(s)}
              </span>
            </>
          )}
        </div>
      </div>
      <Link href="/hotel/reserve"
        className="inline-block text-center px-8 py-3 lg:py-[13px] text-[13px] lg:text-[13.5px] font-bold transition-colors duration-150"
        style={{ background: "#FDFCF9", color: "#1C2418" }}>
        예약 페이지로 →
      </Link>
    </div>
  );
}
