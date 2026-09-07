"use client";

import Link from "next/link";
import { useState } from "react";
import { SITES, type SiteKey } from "@/lib/sites";
import { usePathname } from "next/navigation";

// 그룹핑된 메뉴 — 다크 무채색 사이드바, 활성 항목만 그린 포인트
const NAV_GROUPS: { caption: string; items: { label: string; href: string }[] }[] = [
  { caption: "OVERVIEW", items: [{ label: "대시보드", href: "/admin" }] },
  {
    caption: "커머스",
    items: [
      { label: "상품 관리", href: "/admin/products" },
      { label: "판매 관리", href: "/admin/orders" },
      { label: "배송 관리", href: "/admin/shipments" },
      { label: "리뷰 관리", href: "/admin/reviews" },
      { label: "회원 관리", href: "/admin/members" },
    ],
  },
  {
    caption: "공구 운영",
    items: [
      { label: "인플루언서", href: "/admin/influencers" },
      // 공구 관리(campaigns 축)는 실사용 0건(주문·정산 이력 없음)이라 메뉴 숨김 — 코드·데이터는 유지

      { label: "예약 관리", href: "/admin/reservations" },
      // 호텔 명단 업데이트(/hotel-roster)는 메뉴에서 임시 제거 — 페이지·기능은 유지 (다른 방식으로 교체 검토 중)
    ],
  },
  {
    caption: "정산·수익",
    items: [
      { label: "공구 정산", href: "/admin/influencer-settlements" },
      { label: "수익 관리", href: "/admin/profit" },
      { label: "정산 관리", href: "/admin/settlements" },
    ],
  },
];

function NavLinks({ pathname, onNavigate, siteKey }: { pathname: string; onNavigate?: () => void; siteKey: SiteKey }) {
  return (
    <nav className="flex-1 py-5 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.caption} className={gi > 0 ? "mt-3.5" : ""}>
          <div
            className="px-6 py-1.5 ds-mono font-semibold text-[9.5px]"
            style={{ letterSpacing: "0.22em", color: "#5C6156" }}
          >
            {group.caption}
          </div>
          {group.items.filter(item => siteKey !== "sanjipick" || item.href !== "/admin/reservations").map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="block px-6 py-2 text-[13px] transition-colors"
                style={
                  active
                    ? { color: "#fff", fontWeight: 600, background: "#242720", borderLeft: "2px solid #4E7A46", paddingLeft: "22px" }
                    : { color: "#8F948A" }
                }
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#8F948A"; }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Logo({ siteKey }: { siteKey: SiteKey }) {
  return (
    <Link href="/" className="block px-6 py-6" style={{ borderBottom: "1px solid #2A2D27" }}>
      <p className="font-extrabold text-[15px] text-white" style={{ letterSpacing: "0.06em" }}>{SITES[siteKey].nameEn}</p>
      <p className="ds-mono text-[10px] mt-1" style={{ letterSpacing: "0.24em", color: "#6C7266" }}>{SITES[siteKey].name} 전용 관리자</p>
    </Link>
  );
}

function LogoutButton() {
  return (
    <div
      className="px-6 py-4 flex justify-between items-center text-xs"
      style={{ borderTop: "1px solid #2A2D27" }}
    >
      <span style={{ color: "#C9CDC4" }}>관리자</span>
      <form action="/api/admin/logout" method="POST">
        <button className="transition-colors" style={{ color: "#6C7266" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6C7266")}>
          로그아웃
        </button>
      </form>
    </div>
  );
}

export default function AdminSidebar({ siteKey = "blendpick" }: { siteKey?: SiteKey }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between pl-4 pr-2 py-2.5">
        <Link href="/admin" className="leading-tight">
          <span className="text-xs text-gray-400 font-bold tracking-widest uppercase mr-1.5">{SITES[siteKey].nameEn}</span>
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
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-xl" style={{ background: "#1B1D19" }}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Logo siteKey={siteKey} />
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="p-3 mr-1"
                style={{ color: "#8F948A" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavLinks siteKey={siteKey} pathname={pathname} onNavigate={() => setOpen(false)} />
            <LogoutButton />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-56 flex-col min-h-screen" style={{ background: "#1B1D19" }}>
        <Logo siteKey={siteKey} />
        <NavLinks siteKey={siteKey} pathname={pathname} />
        <LogoutButton />
      </aside>
    </>
  );
}
