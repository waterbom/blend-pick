"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-red-50 text-red-500",
  read: "bg-yellow-50 text-yellow-600",
  replied: "bg-green-50 text-green-600",
};

export default function InquiryButton({
  userId,
  upcoming = [],
}: {
  userId: string | null;
  upcoming?: UpcomingPage[];
}) {
  const [open, setOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("submit");
  const [form, setForm] = useState({ name: "", contact: "", category: "제품문의", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
        <div className="fixed bottom-44 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-xs text-orange-500 font-bold tracking-widest uppercase">coming soon</p>
              <p className="text-sm font-black">🚀 예정된 공구</p>
            </div>
            <button
              onClick={() => setUpcomingOpen(false)}
              className="text-gray-300 hover:text-black text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto max-h-80">
            {upcoming.map((page) => (
              <Link
                key={page.id}
                href={`/products/${page.product_id}`}
                onClick={() => setUpcomingOpen(false)}
                className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="w-12 h-12 shrink-0 bg-gray-100 overflow-hidden rounded-lg">
                  {page.main_image ? (
                    <img src={page.main_image} alt={page.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200 text-lg">📦</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
                    {page.title}
                    {page.influencer_name && (
                      <span className="text-orange-500"> X {page.influencer_name}</span>
                    )}
                  </p>
                  {page.starts_at && (
                    <CountdownTimer target={page.starts_at} label="🚀 오픈까지" />
                  )}
                </div>
              </Link>
            ))}
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
              className="flex flex-col items-center justify-center bg-gradient-to-br from-orange-400 to-pink-500 text-white w-16 h-16 rounded-full shadow-xl hover:scale-110 transition-transform"
              title="예정된 공구"
              style={{ animation: "upcomingPulse 2s ease-in-out infinite" }}
            >
              <span className="text-lg leading-none">🚀</span>
              <span className="text-[9px] font-black tracking-tight leading-none mt-0.5">UP<br/>COMING</span>
              {/* 링 애니메이션 */}
              <span className="absolute inset-0 rounded-full border-2 border-orange-400 opacity-60 pointer-events-none" style={{ animation: "upcomingRing 2s ease-in-out infinite" }} />
              <span className="absolute inset-0 rounded-full border-2 border-pink-400 opacity-40 pointer-events-none" style={{ animation: "upcomingRing 2s ease-in-out infinite 0.5s" }} />
            </button>
            <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow pointer-events-none">
              {upcoming.length}
            </span>
          </div>
        )}

        {/* 문의하기 버튼 */}
        <button
          onClick={() => { setOpen(true); setDone(false); }}
          className="bg-black text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-800 transition-colors"
          title="문의하기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>

      {/* 문의 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full sm:w-[420px] sm:rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-black">문의하기</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black text-xl leading-none">×</button>
            </div>

            <div className="flex border-b border-gray-100">
              {(["submit", "history"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setDone(false); }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === t ? "border-b-2 border-black text-black" : "text-gray-400"
                  }`}
                >
                  {t === "submit" ? "문의 작성" : "문의 현황"}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {tab === "submit" && (
                done ? (
                  <div className="text-center py-10">
                    <p className="text-2xl mb-3">✅</p>
                    <p className="font-bold mb-1">문의가 접수됐어요</p>
                    <p className="text-sm text-gray-400">빠른 시일 내에 답변 드리겠습니다.</p>
                    <button
                      onClick={() => { setDone(false); setTab("history"); }}
                      className="mt-6 text-sm text-black underline underline-offset-2"
                    >
                      문의 현황 보기
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">이름</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                        placeholder="홍길동"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">연락처</label>
                      <input
                        required
                        value={form.contact}
                        onChange={(e) => setForm({ ...form, contact: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                        placeholder="010-0000-0000"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">문의 내용</label>
                      <textarea
                        required
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
                        placeholder="문의 내용을 입력해주세요"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-black text-white py-3 text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {loading ? "전송 중..." : "문의 보내기"}
                    </button>
                  </form>
                )
              )}

              {tab === "history" && (
                !userId ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400">로그인 후 문의 현황을 확인할 수 있어요</p>
                  </div>
                ) : historyLoading ? (
                  <div className="text-center py-10 text-sm text-gray-400">불러오는 중...</div>
                ) : inquiries.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">문의 내역이 없습니다.</div>
                ) : (
                  <ul className="space-y-3">
                    {inquiries.map((inq) => (
                      <li key={inq.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">{inq.category}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[inq.status]}`}>
                            {STATUS_LABEL[inq.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{inq.message}</p>
                        {inq.reply && (
                          <div className="mt-3 bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-400 mb-1">답변</p>
                            <p className="text-sm text-blue-800">{inq.reply}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-300 mt-2">
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
