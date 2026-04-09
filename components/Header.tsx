"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "ALL", href: "/products" },
  { label: "HOT ISSUE", href: "/hot-issue", hot: true },
  { label: "인플루언서", href: "/blend-picked" },
  { label: "구독", href: "/brands" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 bg-white z-50 border-b border-gray-100">
      {/* 1줄: 로고 + 로그인/장바구니 */}
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-12 border-b border-gray-50">
        <Link href="/" className="text-lg font-black tracking-tighter">
          BLEND PICK
        </Link>
        <div className="flex items-center gap-5 text-sm text-gray-500">
          <button className="hover:text-black transition-colors">로그인</button>
          <button className="relative hover:text-black transition-colors">
            장바구니
            <span className="absolute -top-1.5 -right-3.5 bg-black text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              0
            </span>
          </button>
        </div>
      </div>

      {/* 2줄: 햄버거 + 네비 */}
      <div className="max-w-6xl mx-auto px-6 flex items-center h-11 gap-6">
        {/* 햄버거 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex flex-col gap-1 p-1 hover:opacity-60 transition-opacity"
        >
          <span className="w-5 h-px bg-black block" />
          <span className="w-5 h-px bg-black block" />
          <span className="w-5 h-px bg-black block" />
        </button>

        {/* 네비 */}
        <nav className="flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`text-sm font-medium transition-colors whitespace-nowrap ${
                item.hot
                  ? "text-orange-500 font-bold hover:text-orange-600 animate-pulse"
                  : "text-gray-700 hover:text-black"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* 햄버거 드롭다운 (추후 구현) */}
      {menuOpen && (
        <div className="absolute top-full left-0 w-64 bg-white border border-gray-100 shadow-lg p-4 z-50">
          <p className="text-sm text-gray-400">메뉴 준비 중</p>
        </div>
      )}
    </header>
  );
}
