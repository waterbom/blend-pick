"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "대시보드",  href: "/admin",              icon: "📊" },
  { label: "상품 관리", href: "/admin/products",      icon: "📦" },
  { label: "판매 관리", href: "/admin/orders",         icon: "🛒" },
  { label: "배송 관리", href: "/admin/shipments",      icon: "🚚" },
  { label: "인플루언서", href: "/admin/influencers",    icon: "🤝" },
  { label: "공구 관리", href: "/admin/campaigns",      icon: "🛍️" },
  { label: "예약 관리", href: "/admin/reservations",   icon: "🏨" },
  { label: "공구 정산", href: "/admin/influencer-settlements", icon: "🧾" },
  { label: "수익 관리", href: "/admin/profit",         icon: "📈" },
  { label: "정산 관리", href: "/admin/settlements",    icon: "💰" },
  { label: "리뷰 관리", href: "/admin/reviews",        icon: "⭐" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 py-4">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-orange-50 text-orange-600 border-r-2 border-orange-500"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <Link href="/" className="px-6 py-5 border-b border-gray-100 block hover:bg-gray-50 transition-colors">
      <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">Blend Pick</p>
      <p className="text-sm font-black text-gray-900 mt-0.5">Admin</p>
    </Link>
  );
}

function LogoutButton() {
  return (
    <div className="px-6 py-4 border-t border-gray-100">
      <form action="/api/admin/logout" method="POST">
        <button className="text-xs text-gray-400 hover:text-red-500 transition-colors">
          로그아웃
        </button>
      </form>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between pl-4 pr-2 py-2.5">
        <Link href="/admin" className="leading-tight">
          <span className="text-xs text-gray-400 font-bold tracking-widest uppercase mr-1.5">Blend Pick</span>
          <span className="text-sm font-black text-gray-900">Admin</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="p-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* 모바일 드로어 */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Logo />
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="p-3 mr-1 text-gray-400 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col min-h-screen">
        <Logo />
        <NavLinks pathname={pathname} />
        <LogoutButton />
      </aside>
    </>
  );
}
