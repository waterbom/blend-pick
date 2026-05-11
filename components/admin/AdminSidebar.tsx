"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "대시보드",  href: "/admin",              icon: "📊" },
  { label: "상품 관리", href: "/admin/products",      icon: "📦" },
  { label: "주문 관리", href: "/admin/orders",         icon: "🛒" },
  { label: "배송 관리", href: "/admin/shipments",      icon: "🚚" },
  { label: "정산 관리", href: "/admin/settlements",    icon: "💰" },
  { label: "리뷰 관리", href: "/admin/reviews",        icon: "⭐" },
];

export default function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-gray-100">
        <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">Blend Pick</p>
        <p className="text-sm font-black text-gray-900 mt-0.5">Admin</p>
      </div>

      {/* 네비 */}
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

      {/* 하단 유저 */}
      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">로그인</p>
        <p className="text-sm font-medium text-gray-700 truncate">{adminName}</p>
        <form action="/api/admin/logout" method="POST">
          <button className="text-xs text-gray-400 hover:text-red-500 mt-1 transition-colors">
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
