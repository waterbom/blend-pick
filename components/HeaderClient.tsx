"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * 네비게이션 아이템 정의
 * - hot: true면 액센트 컬러로 강조 (기존 animate-pulse는 제거 — 깜빡이는 건 촌스러움)
 */
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
    <header className="sticky top-0 z-50" style={{ background: "var(--cream)" }}>
      {/*
        기존: 2줄 헤더 (로고+로그인 / 햄버거+네비)
        변경: 1줄로 통합 — 로고, 네비, 우측 액션을 한 줄에 배치
        → 시각적으로 깔끔하고, 세로 공간 절약
      */}
      <div className="px-8 flex items-center justify-between h-14">
        {/* 좌측: 햄버거 + 로고 */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col gap-[5px] p-1 hover:opacity-60 transition-opacity"
          >
            <span className="w-5 h-[1.5px] block rounded-full" style={{ background: "var(--text-primary)" }} />
            <span className="w-3.5 h-[1.5px] block rounded-full" style={{ background: "var(--text-primary)" }} />
            <span className="w-5 h-[1.5px] block rounded-full" style={{ background: "var(--text-primary)" }} />
          </button>

          <Link href="/" className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            BLEND PICK
          </Link>

          {/* 네비게이션 */}
          <nav className="hidden sm:flex items-center gap-6 ml-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[13px] font-medium tracking-wide transition-colors duration-200"
                style={{
                  color: item.hot ? "var(--accent)" : "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = item.hot ? "var(--accent)" : "var(--text-secondary)";
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 우측: 로그인/마이페이지 + 장바구니 */}
        <div className="flex items-center gap-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {user ? (
            <Link
              href={isAdmin ? "/admin" : "/mypage"}
              className="flex items-center gap-2 transition-colors duration-200 hover:opacity-80"
            >
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.nickname || user.name || ""}
                  className="w-7 h-7 rounded-full object-cover ring-1"
                  style={{ ringColor: "var(--warm-gray)" } as React.CSSProperties}
                />
              ) : null}
              <span className="text-[13px] font-medium">
                {user.nickname || user.name}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-[13px] font-medium transition-colors duration-200"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
            >
              로그인
            </Link>
          )}
          <Link
            href={user ? "/cart" : "/login"}
            className="relative text-[13px] font-medium transition-colors duration-200"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
          >
            장바구니
            <span
              className="absolute -top-1.5 -right-3.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              0
            </span>
          </Link>
        </div>
      </div>

      {/* 하단 구분선 — 기존 border-gray-100 대신 따뜻한 톤 */}
      <div className="h-px" style={{ background: "var(--warm-gray)" }} />

      {/* 사이드 메뉴 (추후 구현) */}
      {menuOpen && (
        <div
          className="absolute top-full left-0 w-64 shadow-lg p-6 z-50 rounded-br-2xl"
          style={{
            background: "var(--cream)",
            border: `1px solid var(--warm-gray)`,
          }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>메뉴 준비 중</p>
        </div>
      )}
    </header>
  );
}
