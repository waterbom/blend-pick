"use client";

import Link from "next/link";
import SanjiHeader from "@/components/sanji/SanjiHeader";
import { readGuestCart } from "@/lib/guest-cart";
import { useSiteKey } from "@/components/SiteContext";
import { useState, useEffect, useId, useRef } from "react";
import discoveryStyles from "@/components/BlendHeader.module.css";
import InstagramLink from "@/components/blend/InstagramLink";

function CartCount() {
  const site=useSiteKey();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active=true;
    const refresh=()=>fetch('/api/cart').then(r=>r.ok?r.json():null).then(data=>{if(active)setCount((data?.items?.length||0)+readGuestCart(site).length);}).catch(()=>{if(active)setCount(readGuestCart(site).length);});
    refresh();window.addEventListener('cart-change',refresh);window.addEventListener('storage',refresh);
    return()=>{active=false;window.removeEventListener('cart-change',refresh);window.removeEventListener('storage',refresh);};
  }, [site]);

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

const BLEND_NAV_ITEMS = [
  { label: "공구 쇼핑", href: "/products" },
  { label: "숙박·호텔", href: "/hotel" },
  { label: "공급사 제안", href: "/suppliers" },
];

function BlendHeader({ user, isAdmin, isInfluencer }: {
  user: User | null;
  isAdmin: boolean;
  isInfluencer: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountHref = isAdmin ? "/admin" : isInfluencer ? "/influencer" : "/mypage";
  const accountLabel = isAdmin ? "관리자마이페이지" : isInfluencer ? "인플루언서" : "마이페이지";

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const desktopQuery = window.matchMedia("(min-width: 1001px)");
    const handleDesktop = () => {
      if (desktopQuery.matches) setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", handleDesktop);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleDesktop);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const login = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    closeMenu();
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  return (
    <header className={discoveryStyles.header}>
      <div className={discoveryStyles.inner}>
        <Link href="/" className={discoveryStyles.logo} aria-label="BLEND PICK 홈" onClick={closeMenu}>
          <img src="/logo-wide.png" alt="BLEND PICK" width={640} height={290} />
        </Link>
        <nav className={discoveryStyles.navigation} aria-label="주요 메뉴">
          {BLEND_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className={discoveryStyles.actions}>
          <InstagramLink />
          <Link href="/orders/lookup" className={discoveryStyles.orderLink} onClick={closeMenu}>주문 조회</Link>
          {user ? (
            <Link href={accountHref} className={discoveryStyles.account} aria-label={accountLabel} onClick={closeMenu}>
              <span className={discoveryStyles.accountFull}>
                {isAdmin ? "관리자마이페이지" : isInfluencer ? "인플루언서" : user.nickname || user.name || "마이페이지"}
              </span>
              <span className={discoveryStyles.accountShort}>{isAdmin ? "관리자" : isInfluencer ? "내 활동" : "마이"}</span>
            </Link>
          ) : (
            <Link href="/login" className={discoveryStyles.account} onClick={login}>로그인</Link>
          )}
          {!isAdmin && (
            <Link href="/cart" className={discoveryStyles.cart} aria-label="장바구니" onClick={closeMenu}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M6 7h12l1.4 13H4.6L6 7Z" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
              </svg>
              <CartCount />
            </Link>
          )}
          <button
            type="button"
            ref={menuButtonRef}
            className={discoveryStyles.menuButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id={menuId} className={discoveryStyles.mobileMenu} aria-label="모바일 메뉴">
          {BLEND_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu}>{item.label}<span aria-hidden="true">↗</span></Link>
          ))}
          <div className={discoveryStyles.mobileAccount}>
            <Link href="/orders/lookup" onClick={closeMenu}>주문·배송 조회</Link>
            {user ? (
              <Link href={accountHref} onClick={closeMenu}>{accountLabel}</Link>
            ) : (
              <Link href="/login" onClick={login}>로그인</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
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
  if (site?.key === "sanjipick") {
    return <SanjiHeader base={site.basePath} user={user} isAdmin={isAdmin} cartCount={<CartCount />} />;
  }

  // Every Blendpick customer page shares the home header and its responsive sizing.
  return <BlendHeader user={user} isAdmin={isAdmin} isInfluencer={isInfluencer} />;
}
