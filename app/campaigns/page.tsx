"use client";

import { useEffect, useState } from "react";
import SalesPageCard from "@/components/SalesPageCard";

type Tab = "active" | "upcoming" | "ended";

interface SalesPage {
  id: string;
  product_id: string;
  title: string;
  influencer_name?: string | null;
  price: number;
  original_price: number | null;
  main_image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  stock_quantity: number | null;
}

function filterPages(pages: SalesPage[], tab: Tab) {
  return pages.filter((p) => p.status === tab);
}

export default function ProductsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sales-pages")
      .then((r) => r.json())
      .then((data) => {
        setPages(data.pages || []);
        setLoading(false);
      });
  }, []);

  const filtered = filterPages(pages, tab);

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: "active", label: "진행중" },
    { key: "upcoming", label: "예정" },
    { key: "ended", label: "종료" },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="px-6 pt-8">
        <div className="mb-6">
          <h2 className="text-2xl font-black">⏰ HOT DEAL!</h2>
          <p className="text-sm text-gray-400 mt-1">놓치면 후회하는 인플로랩 핫 딜!</p>
        </div>

        <div className="flex gap-1 mb-8 border-b border-gray-100">
          {TAB_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-black text-black"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-300 py-32">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-300 py-32">
            {tab === "active" && "진행중인 핫딜이 없습니다."}
            {tab === "upcoming" && "1주일 내 예정된 핫딜이 없습니다."}
            {tab === "ended" && "최근 종료된 핫딜이 없습니다."}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 pb-16">
            {filtered.map((page) => (
              <SalesPageCard key={page.id} page={page} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
