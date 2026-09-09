"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { SITES, type SiteKey } from "@/lib/sites";

type NavGroup = { caption: string; items: { label: string; href: string }[] };

// 그룹핑된 메뉴 — 사이트별로 사이드바 팔레트·로고가 갈리고, 산지픽에는 숙박(예약 관리) 메뉴가 없다
const NAV_GROUPS: NavGroup[] = [
  { caption: "OVERVIEW", items: [{ label: "대시보드", href: "/admin" }, { label: "오늘 처리할 일", href: "/admin/operations" }] },
  { caption: "통계·점검", items: [{ label: "방문 통계", href: "/admin/visits" }, { label: "서버 트래픽", href: "/admin/traffic" }, { label: "자동 점검", href: "/admin/monitoring" }] },
  {
    caption: "커머스",
    items: [
      { label: "상품 관리", href: "/admin/products" },
      { label: "판매 관리", href: "/admin/orders" },
      { label: "전시·비전시 판매", href: "/admin/link-sales" },
      { label: "결제 확인·복구", href: "/admin/payment-recovery" },
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

// 산지픽에서는 숨기는 메뉴 (숙박) — API도 proxy에서 404
const SANJI_HIDDEN = new Set(["/admin/reservations"]);
// 산지픽 표기 — 같은 화면이라도 이름을 바꿔 다른 사이트처럼
const SANJI_LABEL: Record<string, string> = { "/admin/reviews": "후기 관리", "커머스": "산지 직송" };

// 사이트별 사이드바 팔레트 — 블랜드픽 다크 무채색, 산지픽 딥그린
const THEME = {
  blendpick: { bg: "#1B1D19", line: "#2A2D27", caption: "#5C6156", text: "#8F948A", activeBg: "#242720", accent: "#4E7A46", sub: "#6C7266", who: "#C9CDC4" },
  sanjipick: { bg: "#1F3D24", line: "#2C4F32", caption: "#7FA284", text: "#B9CDB9", activeBg: "#2A5031", accent: "#9BD48F", sub: "#7FA284", who: "#E7EFE3" },
} as const;

function NavLinks({ siteKey, pathname, onNavigate }: { siteKey: SiteKey; pathname: string; onNavigate?: () => void }) {
  const t = THEME[siteKey];
  const isSanji = siteKey === "sanjipick";
  return (
    <nav className="flex-1 py-5 overflow-y-auto">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.caption} className={gi > 0 ? "mt-3.5" : ""}>
          <div className="px-6 py-1.5 ds-mono font-semibold text-[9.5px]" style={{ letterSpacing: "0.22em", color: t.caption }}>
            {isSanji ? SANJI_LABEL[group.caption] ?? group.caption : group.caption}
          </div>
          {group.items.filter((item) => !isSanji || !SANJI_HIDDEN.has(item.href)).map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="block px-6 py-2 text-[13px] transition-colors"
                style={
                  active
                    ? { color: "#fff", fontWeight: 600, background: t.activeBg, borderLeft: `2px solid ${t.accent}`, paddingLeft: "22px" }
                    : { color: t.text }
                }
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = t.text; }}
              >
                {isSanji ? SANJI_LABEL[item.href] ?? item.label : item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Logo({ siteKey }: { siteKey: SiteKey }) {
  const t = THEME[siteKey];
  if (siteKey === "sanjipick") {
    return (
      <Link href="/" className="block px-6 py-5" style={{ borderBottom: `1px solid ${t.line}` }}>
        <img src="/sanji/logo-wide-cream.png" alt="산지픽" className="h-12 w-auto rounded-md" />
        <p className="ds-mono text-[10px] mt-2" style={{ letterSpacing: "0.24em", color: t.sub }}>SANJI PICK ADMIN</p>
      </Link>
    );
  }
  return (
    <Link href="/" className="block px-6 py-5" style={{ borderBottom: `1px solid ${t.line}` }}>
      <img src="/logo-wide-cream.png" alt="BLEND PICK" className="h-12 w-auto rounded-md" />
      <p className="ds-mono text-[10px] mt-2" style={{ letterSpacing: "0.24em", color: t.sub }}>BLEND PICK ADMIN</p>
    </Link>
  );
}

function LogoutButton({ siteKey }: { siteKey: SiteKey }) {
  const t = THEME[siteKey];
  return (
    <div className="px-6 py-4 flex justify-between items-center text-xs" style={{ borderTop: `1px solid ${t.line}` }}>
      <span style={{ color: t.who }}>{siteKey === "sanjipick" ? "산지픽 관리자" : "관리자"}</span>
      <form action="/api/admin/logout" method="POST">
        <button className="transition-colors" style={{ color: t.sub }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = t.sub)}>
          로그아웃
        </button>
      </form>
    </div>
  );
}

export default function AdminSidebar({ siteKey = "blendpick" }: { siteKey?: SiteKey }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = THEME[siteKey];
  const isSanji = siteKey === "sanjipick";

  return (
    <>
      {/* 모바일 상단바 */}
      <div className="md:hidden sticky top-0 z-40 border-b flex items-center justify-between pl-4 pr-2 py-2.5"
        style={{ background: isSanji ? "#FBF8F1" : "#fff", borderColor: isSanji ? "#E8E3D6" : "#E5E7EB" }}>
        <Link href="/admin" className="leading-tight flex items-center gap-2">
          {isSanji ? (
            <>
              <img src="/sanji/logo-wide.png" alt="산지픽" className="h-8 w-auto" />
              <span className="text-sm font-black" style={{ color: "#2F5D34" }}>Admin</span>
            </>
          ) : (
            <>
              <img src="/logo-wide.png" alt="BLEND PICK" className="h-8 w-auto" />
              <span className="text-sm font-black text-gray-900">Admin</span>
            </>
          )}
        </Link>
        <button onClick={() => setOpen(true)} aria-label="메뉴 열기" className="p-2 text-gray-600 hover:text-gray-900">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* 모바일 드로어 */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-xl" style={{ background: t.bg }}>
            <div className="flex items-center justify-between">
              <div className="flex-1"><Logo siteKey={siteKey} /></div>
              <button onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="p-3 mr-1" style={{ color: t.text }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavLinks siteKey={siteKey} pathname={pathname} onNavigate={() => setOpen(false)} />
            <LogoutButton siteKey={siteKey} />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:flex w-56 flex-col min-h-screen" style={{ background: t.bg }}>
        <Logo siteKey={siteKey} />
        <NavLinks siteKey={siteKey} pathname={pathname} />
        <LogoutButton siteKey={siteKey} />
      </aside>
    </>
  );
}
