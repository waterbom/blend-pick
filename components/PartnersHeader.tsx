"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PartnersHeader({ moreCount }: { moreCount: number }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <div className="flex items-end justify-between mb-10">
      <div>
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-4">PARTNERS</p>
        <h2 className="text-2xl font-black flex items-center gap-3">
          함께하는 브랜드
          {moreCount > 0 && (
            <span className="text-sm font-medium text-gray-400">+{moreCount} more</span>
          )}
        </h2>
      </div>
      <div className="flex items-center gap-3 pb-1">
        <p className="text-xs text-gray-400">더 많은 브랜드를 확인해보세요</p>
        <button
          onClick={handleRefresh}
          title="새로고침"
          className="w-8 h-8 flex items-center justify-center border border-gray-200 hover:border-gray-400 transition-colors rounded-full"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={spinning ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
