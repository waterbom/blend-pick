"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

function CartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/cart")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) setCount(data.items.length);
      })
      .catch(() => {});
  }, []);

  if (count === 0) return null;

  return (
    <span
      className="absolute -top-1.5 -right-3.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
      style={{ background: "var(--accent)" }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * 네비게이션 아이템 정의
 * - hot: true면 액센트 컬러로 강조 (기존 animate-pulse는 제거 — 깜빡이는 건 촌스러움)
 */
const NAV_ITEMS = [
  { label: "호텔공구 × 여수 UTOP 마리나 호텔", href: "/hotel", hot: true },
  { label: "PRODUCTS", href: "/products", hot: false },
  { label: "CONTACT", href: "/blend-picked" },
];

interface User {
  nickname: string | null;
  name: string | null;
  profile_image: string | null;
}

export default function HeaderClient({ user, isAdmin = false }: { user: User | null; isAdmin?: boolean }) {

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderColor: "var(--line)" }}
    >
      {/*
        기존: 2줄 헤더 (로고+로그인 / 햄버거+네비)
        변경: 1줄로 통합 — 로고, 네비, 우측 액션을 한 줄에 배치
        → 시각적으로 깔끔하고, 세로 공간 절약
      */}
      <div className="container-blend flex items-center justify-between h-14 sm:h-16">
        {/* 좌측: 로고 */}
        <div className="flex items-center">
          <Link href="/" className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            BLEND PICK
          </Link>

          {/* 구분선 */}
          <div className="hidden sm:block w-px h-4 mx-5 lg:mx-6 rounded-full" style={{ background: "var(--line)" }} />

          {/* 네비게이션 */}
          <nav className="hidden sm:flex items-center gap-6">
            {NAV_ITEMS.map((item) =>
              item.href === "/hotel" ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[13px] font-extrabold tracking-wide whitespace-nowrap transition-all duration-200 hover:brightness-110"
                  style={{
                    backgroundImage: "linear-gradient(90deg,#14b8a6,#22d3ee,#ec4899)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    filter: "drop-shadow(0 0 6px rgba(34,211,238,0.45))",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
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
              )
            )}
          </nav>
        </div>

        {/* 우측: 로그인/마이페이지 + 장바구니 */}
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {user ? (
            isAdmin ? (
              /* 관리자 */
              <div className="flex items-center gap-3">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  관리자모드
                </span>
                <Link
                  href="/admin"
                  className="text-[13px] font-medium transition-colors duration-200 hover:opacity-80"
                  style={{ color: "var(--text-primary)" }}
                >
                  관리자마이페이지
                </Link>
              </div>
            ) : (
              /* 일반 유저 */
              <Link
                href="/mypage"
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
            )
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
          {user && !isAdmin && (
            <Link
              href="/cart"
              className="relative text-[13px] font-medium transition-colors duration-200"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
            >
              장바구니
              <CartCount />
            </Link>
          )}
        </div>
      </div>


    </header>
  );
}
