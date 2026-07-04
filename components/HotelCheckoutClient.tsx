"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { WON, REFUND_POLICY, PARTNER_BENEFITS, type PkgKey, type RoomType } from "@/lib/hotel";

interface Reservation {
  pkg: PkgKey;
  room: RoomType;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  packageLabel: string;
  people: string;
}
interface Breakdown {
  items: { iso: string; won: number }[];
  discount: number;
  total: number;
}
interface Hotel {
  name: string;
  tagline: string;
  image: string;
  checkInTime: string;
  checkOutTime: string;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function fmt(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d} (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

const PAY_METHODS = [
  { key: "card", label: "카드" },
  { key: "kakao", label: "카카오페이" },
  { key: "toss", label: "토스페이" },
] as const;

export default function HotelCheckoutClient({
  clientKey, isLoggedIn, hotel, reservation, breakdown,
}: {
  clientKey: string;
  isLoggedIn: boolean;
  hotel: Hotel;
  reservation: Reservation;
  breakdown: Breakdown;
}) {
  const [form, setForm] = useState({ name: "", phone: "", memo: "" });
  const [method, setMethod] = useState<(typeof PAY_METHODS)[number]["key"]>("card");
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    // 비회원도 결제 가능 — 예약자 성함/연락처만 필수 (로그인 시 주문이 계정에 연결됨)
    if (!form.name || !form.phone) {
      alert("예약자 성함과 연락처를 입력해주세요.");
      return;
    }
    setLoading(true);

    const checkoutData = {
      pkg: reservation.pkg,
      room: reservation.room,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      nights: reservation.nights,
      hotelName: hotel.name,
      packageLabel: reservation.packageLabel,
      customerName: form.name,
      customerPhone: form.phone,
      customerMemo: form.memo,
    };
    sessionStorage.setItem("hotelCheckoutData", JSON.stringify(checkoutData));

    const orderId = crypto.randomUUID();
    try {
      const toss = await loadTossPayments(clientKey);
      const payment = toss.payment({ customerKey: "ANONYMOUS" });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: reservation.total },
        orderId,
        orderName: `${hotel.name} · ${reservation.packageLabel}`,
        successUrl: `${window.location.origin}/checkout/hotel-success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: form.name,
        customerMobilePhone: form.phone.replace(/-/g, ""),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none transition-colors";
  const inputStyle = { border: "1px solid var(--line)", background: "#fff" };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-xl font-extrabold tracking-tight mb-5" style={{ color: "var(--text-primary)" }}>예약 / 결제</h1>

      {/* 호텔 요약 */}
      <section className="bg-white rounded-2xl p-4 mb-4" style={{ border: "1px solid var(--line)" }}>
        <div className="flex gap-4">
          <img src={hotel.image} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
          <div className="min-w-0 pt-0.5">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hotel.tagline}</p>
            <p className="text-base font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{hotel.name}</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{reservation.packageLabel} · {reservation.room}</p>
          </div>
        </div>

        {/* 체크인 / 체크아웃 / 인원 */}
        <div className="grid grid-cols-3 mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          {[
            { label: "체크인", main: fmt(reservation.checkIn), sub: hotel.checkInTime },
            { label: "체크아웃", main: fmt(reservation.checkOut), sub: hotel.checkOutTime },
            { label: "인원", main: reservation.people, sub: `${reservation.nights}박` },
          ].map((c, i) => (
            <div key={c.label} className="text-center py-3" style={{ borderLeft: i > 0 ? "1px solid var(--line)" : "none", background: "var(--surface-soft)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.label}</p>
              <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>{c.main}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 예약자 정보 */}
      <section className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>예약자 정보</h2>
        <div className="space-y-2.5">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="예약자 성함" className={inputCls} style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
          <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="연락처" className={inputCls} style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
          <input value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
            placeholder="요청사항 (선택) — 예: 고층 요청" className={inputCls} style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
        </div>
      </section>

      {/* 결제 수단 */}
      <section className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>결제 수단</h2>
        <div className="grid grid-cols-3 gap-2">
          {PAY_METHODS.map((m) => {
            const on = method === m.key;
            return (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className="py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: on ? "var(--accent-soft)" : "#fff", color: on ? "var(--accent)" : "var(--text-secondary)", border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}` }}>
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 요금 상세 */}
      <section className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>요금 상세</h2>
        <div className="space-y-2 text-sm tnum" style={{ color: "var(--text-secondary)" }}>
          {breakdown.items.map((it) => (
            <div key={it.iso} className="flex justify-between">
              <span>{fmt(it.iso)} 1박</span>
              <span>{WON(it.won)}</span>
            </div>
          ))}
          {breakdown.discount > 0 && (
            <div className="flex justify-between" style={{ color: "var(--sale)" }}>
              <span>공구 할인</span>
              <span>-{WON(breakdown.discount)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-3 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>총 결제금액</span>
            <span className="text-xl font-extrabold" style={{ color: "var(--accent)" }}>{WON(breakdown.total)}</span>
          </div>
        </div>
      </section>

      {/* 예약 및 취소 규정 */}
      <section className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>📌 예약 및 취소규정</h2>
        <ul className="space-y-1.5">
          {REFUND_POLICY.map((r) => (
            <li key={r.when} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--text-secondary)" }}>{r.when}</span>
              <span className="font-semibold" style={{ color: r.rate.includes("불가") ? "var(--text-muted)" : "var(--text-primary)" }}>{r.rate}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 결제 버튼 */}
      <div className="mb-6">
        {!isLoggedIn && (
          <p className="text-xs text-center mb-2" style={{ color: "var(--text-muted)" }}>비회원으로도 예약할 수 있어요 · 예약번호로 확인됩니다</p>
        )}
        <button onClick={handlePay} disabled={loading}
          className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all hover:brightness-95 disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {loading ? "처리 중..." : `${WON(breakdown.total)} 결제하기`}
        </button>
      </div>

      {/* 그 외 즐길거리 (업체정보) */}
      <section className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--line)" }}>
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>🎟️ 투숙객 전용 · 그 외 즐길거리</h2>
        <p className="text-xs mb-4 mt-0.5" style={{ color: "var(--text-muted)" }}>예약 내역 제시 시 제휴처에서 할인 적용</p>
        <div className="space-y-3">
          {PARTNER_BENEFITS.map((p) => (
            <div key={p.title} className="rounded-xl p-4" style={{ background: "var(--surface-soft)" }}>
              <p className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>{p.title}</p>
              <ul className="space-y-1">
                {p.lines.map((l, i) => (
                  <li key={i} className="text-xs leading-relaxed" style={{ color: l.startsWith("※") ? "var(--sale)" : "var(--text-secondary)" }}>· {l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
