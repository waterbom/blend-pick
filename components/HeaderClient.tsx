"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "HOT ISSUE", href: "/hot-issue", hot: true },
  { label: "CONTACT", href: "/blend-picked" },
];

interface User {
  nickname: string | null;
  name: string | null;
  profile_image: string | null;
}

export default function HeaderClient({ user, isAdmin = false }: { user: User | null; isAdmin?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 bg-white z-50 border-b border-gray-100">
      {/* 1줄: 로고 + 로그인/장바구니 */}
      <div className="px-6 flex items-center justify-between h-12 border-b border-gray-50">
        <Link href="/" className="text-lg font-black tracking-tighter">
          BLEND PICK
        </Link>
        <div className="flex items-center gap-5 text-sm text-gray-500">
          {user ? (
            <Link
              href={isAdmin ? "/admin" : "/mypage"}
              className="flex items-center gap-2 hover:text-black transition-colors"
            >
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.nickname || user.name || ""}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium">
                  {user.nickname || user.name}
                </span>
              )}
              <span className="text-sm font-medium">{user.nickname}</span>
            </Link>
          ) : (
            <Link href="/login" className="hover:text-black transition-colors">
              로그인
            </Link>
          )}
          <Link href={user ? "/cart" : "/login"} className="relative hover:text-black transition-colors">
            장바구니
            <span className="absolute -top-1.5 -right-3.5 bg-black text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              0
            </span>
          </Link>
        </div>
      </div>

      {/* 2줄: 햄버거 + 네비 */}
      <div className="px-6 flex items-center h-11 gap-6">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex flex-col gap-1 p-1 hover:opacity-60 transition-opacity"
        >
          <span className="w-5 h-px bg-black block" />
          <span className="w-5 h-px bg-black block" />
          <span className="w-5 h-px bg-black block" />
        </button>

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

      {menuOpen && (
        <div className="absolute top-full left-0 w-64 bg-white border border-gray-100 shadow-lg p-4 z-50">
          <p className="text-sm text-gray-400">메뉴 준비 중</p>
        </div>
      )}
    </header>
  );
}
