"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";
import FallbackImg from "@/components/FallbackImg";

type Tab = "submit" | "history";

const CATEGORIES = ["제품문의", "서비스문의", "기타"];

interface Inquiry {
  id: string;
  category: string;
  message: string;
  status: "pending" | "read" | "replied";
  reply: string | null;
  created_at: string;
}

interface UpcomingPage {
  id: string;
  product_id: string;
  title: string;
  price: number;
  main_image: string | null;
  starts_at: string | null;
  influencer_name?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "대기중",
  read: "확인됨",
  replied: "답변완료",
};

/**
 * 상태별 뱃지 색상
 * 기존: red/yellow/green 원색
 * 변경: 더 부드러운 톤으로 교체
 */
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-500",
  read: "bg-sky-50 text-sky-500",
  replied: "bg-emerald-50 text-emerald-500",
};

interface RecentProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  original_price: number | null;
  main_image: string | null;
  status: string;
  stock: number;
}

export default function InquiryButton({
  userId,
  upcoming = [],
}: {
  userId: string | null;
  upcoming?: UpcomingPage[];
}) {
  const [open, setOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [selectedRecent, setSelectedRecent] = useState<RecentProduct | null>(null);
  const [tab, setTab] = useState<Tab>("submit");
  const [form, setForm] = useState({ name: "", contact: "", category: "제품문의", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 최근 본 상품 로드 함수
  function loadRecentProducts() {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem("recentProducts") || "[]");
      if (ids.length === 0) { setRecentProducts([]); return; }
      fetch("/api/products/recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
        .then((r) => r.json())
        .then((data) => setRecentProducts(data.products || []));
    } catch {}
  }

  useEffect(() => {
    loadRecentProducts();
    window.addEventListener("recentProductsUpdated", loadRecentProducts);
    return () => window.removeEventListener("recentProductsUpdated", loadRecentProducts);
  }, []);

  useEffect(() => {
    if (tab === "history" && open) {
      setHistoryLoading(true);
      fetch("/api/inquiry")
        .then((r) => r.json())
        .then((data) => setInquiries(data.inquiries || []))
        .finally(() => setHistoryLoading(false));
    }
  }, [tab, open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setDone(true);
        setForm({ name: "", contact: "", category: "제품문의", message: "" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* 예정 공구 팝업 */}
      {upcomingOpen && upcoming.length > 0 && (
        <div
          className="fixed right-6 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden"
          style={{ bottom: "14rem", background: "#fff", border: "1px solid var(--warm-gray)" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--warm-gray)" }}>
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: "var(--accent)" }}>
                coming soon
              </p>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>예정된 공구</p>
            </div>
            <button
              onClick={() => setUpcomingOpen(false)}
              className="text-xl leading-none transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto max-h-80">
            {upcoming.map((page) => (
              <Link
                key={page.id}
                href={`/campaigns/${page.product_id}`}
                onClick={() => setUpcomingOpen(false)}
                className="flex gap-3 px-4 py-3 transition-colors"
                style={{ borderBottom: "1px solid var(--cream-dark)" }}
              >
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl" style={{ background: "var(--cream-dark)" }}>
                  <FallbackImg src={page.main_image} alt={page.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-2 leading-snug mb-1" style={{ color: "var(--text-primary)" }}>
                    {page.title}
                    {page.influencer_name && (
                      <span style={{ color: "var(--accent)" }}> x {page.influencer_name}</span>
                    )}
                  </p>
                  {page.starts_at && (
                    <CountdownTimer target={page.starts_at} label="오픈까지" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 최근 본 상품 — 가로 pill + 상품 카드 */}
      {recentProducts.length > 0 && (
        <div className="fixed z-40 flex flex-col items-end gap-2" style={{ bottom: "10rem", right: "1.5rem" }}>
          {/* 선택된 상품 카드 */}
          {selectedRecent && (
            <div
              className="w-52 rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid var(--warm-gray)" }}
            >
              <div className="relative w-full aspect-square">
                <FallbackImg src={selectedRecent.main_image} alt={selectedRecent.name} className="w-full h-full object-cover" />
                {(selectedRecent.status === "soldout" || selectedRecent.stock === 0) && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">품절</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedRecent(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm leading-none"
                  style={{ background: "rgba(0,0,0,0.45)" }}
                >
                  ×
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold line-clamp-2 leading-snug mb-1" style={{ color: "var(--text-primary)" }}>
                  {selectedRecent.name}
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                  {selectedRecent.price.toLocaleString()}원
                </p>
                <Link
                  href={`/products/${selectedRecent.id}`}
                  className="block mt-2 text-center text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--accent)" }}
                  onClick={() => setSelectedRecent(null)}
                >
                  상품 보기
                </Link>
              </div>
            </div>
          )}

          {/* 가로 pill 바 */}
          <div
            className="flex items-center gap-3 pl-4 pr-3 py-2 rounded-full shadow-lg"
            style={{ background: "#fff", border: "1px solid var(--warm-gray)" }}
          >
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              최근 본 상품
            </span>
            <div className="flex items-center">
              {recentProducts.slice(0, 5).map((p, i) => {
                const isSoldout = p.status === "soldout" || p.stock === 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedRecent((prev) => (prev?.id === p.id ? null : p))}
                    className="w-9 h-9 rounded-full overflow-hidden transition-all"
                    style={{
                      marginLeft: i > 0 ? "-8px" : "0",
                      zIndex: recentProducts.length - i,
                      position: "relative",
                      border: selectedRecent?.id === p.id ? "2px solid var(--accent)" : "2px solid #fff",
                      background: "var(--cream-dark)",
                      opacity: isSoldout ? 0.5 : 1,
                    }}
                  >
                    <FallbackImg src={p.main_image} alt={p.name} className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 영역 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* 예정 공구 버튼 */}
        {upcoming.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setUpcomingOpen((v) => !v)}
              className="flex flex-col items-center justify-center text-white w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-105"
              title="예정된 공구"
              style={{
                background: "linear-gradient(135deg, var(--accent-light), var(--accent))",
                animation: "upcomingPulse 2s ease-in-out infinite",
              }}
            >
              <span className="text-sm leading-none font-bold tracking-tight">UP</span>
              <span className="text-[8px] font-bold tracking-tight leading-none">COMING</span>
              <span className="absolute inset-0 rounded-full pointer-events-none" style={{ border: "2px solid var(--accent-light)", animation: "upcomingRing 2s ease-in-out infinite" }} />
            </button>
            <span
              className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow pointer-events-none"
              style={{ background: "var(--text-primary)" }}
            >
              {upcoming.length}
            </span>
          </div>
        )}

        {/* 문의하기 버튼 — 검정 → 따뜻한 다크 */}
        <button
          onClick={() => { setOpen(true); setDone(false); }}
          className="text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
          title="문의하기"
          style={{ background: "var(--text-primary)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>

      {/* 문의 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:w-[420px] sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" style={{ background: "#fff" }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--warm-gray)" }}>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>문의하기</h2>
              <button onClick={() => setOpen(false)} className="text-xl leading-none" style={{ color: "var(--text-muted)" }}>×</button>
            </div>

            {/* 탭 */}
            <div className="flex" style={{ borderBottom: "1px solid var(--warm-gray)" }}>
              {(["submit", "history"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setDone(false); }}
                  className="flex-1 py-3 text-sm font-medium transition-colors"
                  style={{
                    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                    color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {t === "submit" ? "문의 작성" : "문의 현황"}
                </button>
              ))}
            </div>

            {/* 콘텐츠 */}
            <div className="overflow-y-auto flex-1 p-6">
              {tab === "submit" && (
                done ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-bold mb-1" style={{ color: "var(--text-primary)" }}>문의가 접수됐어요</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>빠른 시일 내에 답변 드리겠습니다.</p>
                    <button
                      onClick={() => { setDone(false); setTab("history"); }}
                      className="mt-6 text-sm font-medium underline underline-offset-4"
                      style={{ color: "var(--accent)" }}
                    >
                      문의 현황 보기
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>이름</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                        style={{ border: "1px solid var(--warm-gray)", background: "#fff" }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "var(--warm-gray)"; }}
                        placeholder="홍길동"
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>연락처</label>
                      <input
                        required
                        value={form.contact}
                        onChange={(e) => setForm({ ...form, contact: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                        style={{ border: "1px solid var(--warm-gray)", background: "#fff" }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "var(--warm-gray)"; }}
                        placeholder="010-0000-0000"
                      />
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>카테고리</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                        style={{ border: "1px solid var(--warm-gray)", background: "#fff" }}
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>문의 내용</label>
                      <textarea
                        required
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none transition-colors"
                        style={{ border: "1px solid var(--warm-gray)", background: "#fff" }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "var(--warm-gray)"; }}
                        placeholder="문의 내용을 입력해주세요"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full text-white py-3 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 hover:shadow-lg"
                      style={{ background: "var(--accent)" }}
                    >
                      {loading ? "전송 중..." : "문의 보내기"}
                    </button>
                  </form>
                )
              )}

              {tab === "history" && (
                !userId ? (
                  <div className="text-center py-10">
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>로그인 후 문의 현황을 확인할 수 있어요</p>
                  </div>
                ) : historyLoading ? (
                  <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>불러오는 중...</div>
                ) : inquiries.length === 0 ? (
                  <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>문의 내역이 없습니다.</div>
                ) : (
                  <ul className="space-y-3">
                    {inquiries.map((inq) => (
                      <li key={inq.id} className="rounded-xl p-4" style={{ border: "1px solid var(--warm-gray)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{inq.category}</span>
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLOR[inq.status]}`}>
                            {STATUS_LABEL[inq.status]}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>{inq.message}</p>
                        {inq.reply && (
                          <div className="mt-3 rounded-xl p-3" style={{ background: "var(--accent-soft)" }}>
                            <p className="text-xs mb-1" style={{ color: "var(--accent)" }}>답변</p>
                            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{inq.reply}</p>
                          </div>
                        )}
                        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                          {new Date(inq.created_at).toLocaleDateString("ko-KR")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
