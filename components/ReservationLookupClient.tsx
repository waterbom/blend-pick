"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HOTEL } from "@/lib/hotel";

interface Reservation {
  order_number: string;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  total_amount: number;
  check_in: string;
  check_out: string;
  created_at: string;
  product_name: string | null;
}

const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "http://pf.kakao.com/_VyING/chat";
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function fmt(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d} (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  paid:       { label: "예약확정",   color: "#2563eb", bg: "#eff6ff" },
  checked_in: { label: "체크인완료", color: "#16a34a", bg: "#f0fdf4" },
  cancelled:  { label: "예약취소",   color: "#9ca3af", bg: "#f3f4f6" },
  no_show:    { label: "노쇼",       color: "#dc2626", bg: "#fef2f2" },
};

export default function ReservationLookupClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rv, setRv] = useState<Reservation | null>(null);

  // 예약완료 화면에서 넘어오면 예약번호 자동 입력
  useEffect(() => {
    const on = new URLSearchParams(window.location.search).get("on");
    if (on) setOrderNumber(on);
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || phone.replace(/[^0-9]/g, "").length < 10) { setError("예약번호와 연락처를 정확히 입력해주세요."); return; }
    setLoading(true); setError(""); setRv(null);
    try {
      const res = await fetch("/api/hotel/reservation/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, phone }),
      });
      const d = await res.json();
      if (d.ok) setRv(d.reservation);
      else setError(d.error || "조회에 실패했어요.");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  const parts = (rv?.product_name || "").split(" · ");
  const pkg = parts[1] || "";
  const room = parts[2] || "";
  const st = rv ? (STATUS[rv.status] ?? { label: rv.status, color: "#6b7280", bg: "#f3f4f6" }) : null;

  const inputCls = "w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none transition-colors";
  const inputStyle = { border: "1px solid var(--line)", background: "#fff" };

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>예약 조회</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>비회원도 예약번호와 연락처로 예약을 확인할 수 있어요.</p>

      {/* 조회 폼 */}
      <form onSubmit={lookup} className="bg-white rounded-2xl p-5 mb-5 space-y-2.5" style={{ border: "1px solid var(--line)" }}>
        <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="예약번호 (예: BP-H-20260801-A1B2C3)" className={inputCls} style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="예약자 연락처 ( - 없이 숫자만 )" inputMode="numeric" className={inputCls} style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
        <button type="submit" disabled={loading}
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-95 disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {loading ? "조회 중..." : "예약 조회하기"}
        </button>
        {error && <p className="text-xs text-center pt-1" style={{ color: "var(--sale)" }}>{error}</p>}
      </form>

      {/* 결과 카드 */}
      {rv && st && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px dashed var(--line)" }}>
          <img src={HOTEL.image} alt="" className="w-full h-40 object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="p-5 bg-white">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{HOTEL.tagline}</p>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
            </div>
            <p className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>{HOTEL.name}</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{[pkg, room].filter(Boolean).join(" · ")}</p>

            <div className="mt-3 pt-3 space-y-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>예약번호</span><span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{rv.order_number}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>예약자</span><span style={{ color: "var(--text-primary)" }}>{rv.buyer_name}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>체크인</span><span style={{ color: "var(--text-primary)" }}>{fmt(rv.check_in)} {HOTEL.checkInTime}</span></div>
              <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>체크아웃</span><span style={{ color: "var(--text-primary)" }}>{fmt(rv.check_out)} {HOTEL.checkOutTime}</span></div>
              <div className="flex justify-between items-baseline pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text-secondary)" }}>결제금액</span>
                <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{Number(rv.total_amount).toLocaleString()}원</span>
              </div>
            </div>

            {rv.status !== "cancelled" && (
              <>
                <div className="rounded-xl px-4 py-3 mt-4 text-center" style={{ background: "var(--accent-soft)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>🏨 체크인 시 이 화면(또는 예약 확인 문자)을</p>
                  <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>호텔 프런트에 보여주시면 입장 가능합니다</p>
                </div>

                {/* 예약 취소 방법 — 잘 보이게 */}
                <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 mt-3 transition-transform active:scale-[0.99]"
                  style={{ background: "#FEE500", color: "#191600" }}>
                  <span className="text-base">💬</span>
                  <span className="text-sm font-bold">예약 취소·변경 문의하기 (카카오톡)</span>
                </a>
                <p className="text-[11px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
                  체크인 6일 전까지 100% 환불 · 5~3일 전 50% · 2~1일 전 30% · 당일/노쇼 환불 불가
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="text-center mt-6">
        <Link href="/hotel" className="text-xs" style={{ color: "var(--text-muted)" }}>← 호텔 공구로 돌아가기</Link>
      </div>
    </div>
  );
}
