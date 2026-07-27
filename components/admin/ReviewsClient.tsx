"use client";

import { useEffect, useState } from "react";

interface Review {
  id: string;
  product_id: string | null;
  product_name: string | null;
  product_code: string | null;
  buyer_name: string;
  rating: number;
  content: string;
  images: string[] | null;
  is_hidden: boolean;
  created_at: string;
}

const TABS = [
  { key: "", label: "전체" },
  { key: "visible", label: "표시 중" },
  { key: "hidden", label: "숨김" },
] as const;

export default function ReviewsClient() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("");

  async function load() {
    const r = await fetch("/api/admin/reviews").then((x) => x.json()).catch(() => []);
    setRows(Array.isArray(r) ? r : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleHidden(rv: Review) {
    await fetch("/api/admin/reviews", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rv.id, is_hidden: !rv.is_hidden }),
    });
    setRows((prev) => prev.map((x) => (x.id === rv.id ? { ...x, is_hidden: !rv.is_hidden } : x)));
  }

  async function remove(rv: Review) {
    if (!confirm("이 리뷰를 삭제할까요? 되돌릴 수 없어요.\n(부적절한 내용이 아니라면 삭제보다 숨김을 권장)")) return;
    await fetch("/api/admin/reviews", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rv.id }),
    });
    setRows((prev) => prev.filter((x) => x.id !== rv.id));
  }

  const visible = rows.filter((r) =>
    tab === "visible" ? !r.is_hidden : tab === "hidden" ? r.is_hidden : true
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "#1A1D18" }}>리뷰 관리</h1>
        <span className="ds-mono text-xs" style={{ color: "#8F948A" }}>
          총 {rows.length}건 · 숨김 {rows.filter((r) => r.is_hidden).length}건
        </span>
      </div>

      {/* 탭 */}
      <div className="flex w-fit mb-4">
        {TABS.map((t, ti) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 text-xs font-semibold transition-colors"
            style={{
              border: "1px solid", marginLeft: ti > 0 ? "-1px" : 0,
              background: tab === t.key ? "#1A1D18" : "#fff",
              color: tab === t.key ? "#fff" : "#5C6156",
              borderColor: tab === t.key ? "#1A1D18" : "#D6D6CF",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm py-16 text-center" style={{ color: "#8F948A" }}>불러오는 중…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white py-16 text-center text-sm" style={{ border: "1px solid #E2E2DC", color: "#8F948A" }}>
          리뷰가 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((rv) => (
            <div key={rv.id} className="bg-white p-5" style={{ border: "1px solid #E2E2DC", opacity: rv.is_hidden ? 0.55 : 1 }}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold" style={{ color: "#1A1D18" }}>{rv.product_name || "(삭제된 상품)"}</span>
                  {rv.product_code && <span className="ds-mono text-xs" style={{ color: "#8F948A" }}>{rv.product_code}</span>}
                  {rv.is_hidden && (
                    <span className="text-[11px] font-bold px-2 py-0.5" style={{ background: "#F4F4F1", color: "#A6412F" }}>숨김</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleHidden(rv)}
                    className="text-xs font-semibold px-3 py-1.5 transition-colors"
                    style={{ border: "1px solid #D6D6CF", color: "#5C6156", background: "#fff" }}>
                    {rv.is_hidden ? "다시 표시" : "숨김"}
                  </button>
                  <button onClick={() => remove(rv)}
                    className="text-xs font-semibold px-3 py-1.5"
                    style={{ border: "1px solid #E8C4BC", color: "#A6412F", background: "#fff" }}>
                    삭제
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1.5 text-xs" style={{ color: "#8F948A" }}>
                <span style={{ color: "#F5A524" }}>{"★".repeat(rv.rating)}{"☆".repeat(5 - rv.rating)}</span>
                <span>{rv.buyer_name}</span>
                <span>{new Date(rv.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#3E423A" }}>{rv.content}</p>
              {rv.images && rv.images.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {rv.images.map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                      <img src={img} alt="" className="w-16 h-16 object-cover" style={{ border: "1px solid #E2E2DC" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
