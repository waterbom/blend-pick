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
  // 호텔·펜션을 아우르는 숙박 카테고리 — 특정 호텔명 대신 카테고리명으로 (공구마다 이름 안 바꿔도 되게)
  { label: "숙박공구 · 호텔 & 펜션", href: "/hotel", hot: true },
  { label: "PRODUCTS", href: "/products", hot: false },
  { label: "CONTACT", href: "/blend-picked" },
];

// 산지픽 네비 — 농산물 사이트라 숙박 메뉴 없음
const SANJI_NAV_ITEMS = [
  { label: "지금 산지 직송", href: "/sanji", hot: true },
  { label: "산지픽 이야기", href: "/sanji/about", hot: false },
  { label: "CONTACT", href: "/blend-picked" },
];

interface User {
  nickname: string | null;
  name: string | null;
  profile_image: string | null;
}

// 어느 사이트의 헤더인지 — 로고·네비만 바뀌고 로그인/장바구니는 공용
export interface HeaderSite {
  key: "blendpick" | "sanjipick";
  nameEn: string;
  basePath: string;
}

export default function HeaderClient({
  user,
  isAdmin = false,
  isInfluencer = false,
  site,
}: {
  user: User | null;
  isAdmin?: boolean;
  isInfluencer?: boolean;
  site?: HeaderSite;
}) {
  // 모바일 햄버거 메뉴 — sm 미만에서는 네비가 숨겨지므로 여기로 카테고리 진입
  const [menuOpen, setMenuOpen] = useState(false);
  const isSanji = site?.key === "sanjipick";
  const navItems = isSanji ? SANJI_NAV_ITEMS : NAV_ITEMS;
  const homeHref = isSanji ? site!.basePath || "/" : "/";

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: isSanji ? "rgba(251,248,241,0.9)" : "rgba(255,255,255,0.85)", backdropFilter: "saturate(180%) blur(12px)", WebkitBackdropFilter: "saturate(180%) blur(12px)", borderColor: "var(--line)" }}
    >
      {/*
        기존: 2줄 헤더 (로고+로그인 / 햄버거+네비)
        변경: 1줄로 통합 — 로고, 네비, 우측 액션을 한 줄에 배치
        → 시각적으로 깔끔하고, 세로 공간 절약
      */}
      {/* 산지픽은 메인(SanjiHome) 헤더와 같은 높이 74px(14 + 로고 52 + 8) — 화면 전환 때 헤더가 튀지 않게 */}
      <div className={`container-blend flex items-center justify-between ${isSanji ? "h-[74px]" : "h-14 sm:h-16"}`}>
        {/* 좌측: 로고 */}
        <div className="flex items-center">
          {isSanji ? (
            <Link href={homeHref} className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
              <img src="/sanji/logo-wide.png" alt="산지픽 SANJI PICK" className="h-[52px] w-auto" />
            </Link>
          ) : (
            <Link href="/" className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              BLEND PICK
            </Link>
          )}

          {/* 구분선 */}
          <div className="hidden sm:block w-px h-4 mx-5 lg:mx-6 rounded-full" style={{ background: "var(--line)" }} />

          {/* 네비게이션 */}
          <nav className="hidden sm:flex items-center gap-6">
            {navItems.map((item) =>
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
            ) : isInfluencer ? (
              /* 인플루언서 — 마이페이지 대신 인플루언서 탭 */
              <Link
                href="/influencer"
                className="flex items-center gap-2 transition-colors duration-200 hover:opacity-80"
              >
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  인플루언서
                </span>
                <span className="text-[13px] font-medium">
                  {user.nickname || user.name}
                </span>
              </Link>
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

          {/* 모바일 햄버거 (데스크톱에선 네비가 보이므로 숨김) */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            className="sm:hidden p-1.5 -mr-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 펼침 메뉴 */}
      {menuOpen && (
        <nav className="sm:hidden border-t" style={{ borderColor: "var(--line)" }}>
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="block px-5 py-3.5 text-sm font-bold border-b"
              style={
                item.href === "/hotel"
                  ? {
                      borderColor: "var(--line-soft)",
                      backgroundImage: "linear-gradient(90deg,#14b8a6,#22d3ee,#ec4899)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }
                  : { borderColor: "var(--line-soft)", color: item.hot ? "var(--accent)" : "var(--text-secondary)" }
              }
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/orders/lookup"
            onClick={() => setMenuOpen(false)}
            className="block px-5 py-3.5 text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            주문 조회
          </Link>
        </nav>
      )}
    </header>
  );
}
