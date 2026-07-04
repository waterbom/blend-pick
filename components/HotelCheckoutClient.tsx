"use client";

import { useState, useEffect } from "react";
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
function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const PAY_METHODS = [
  { key: "card", label: "카드" },
  { key: "kakao", label: "카카오페이" },
  { key: "toss", label: "토스페이" },
] as const;

export default function HotelCheckoutClient({
  clientKey, isLoggedIn, phoneVerifyEnabled, hotel, reservation, breakdown,
}: {
  clientKey: string;
  isLoggedIn: boolean;
  phoneVerifyEnabled: boolean;
  hotel: Hotel;
  reservation: Reservation;
  breakdown: Breakdown;
}) {
  const [form, setForm] = useState({ name: "", phone: "", memo: "" });
  const [method, setMethod] = useState<(typeof PAY_METHODS)[number]["key"]>("card");
  const [loading, setLoading] = useState(false);

  // 휴대폰 인증
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [left, setLeft] = useState(0); // 남은 초

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  function onPhoneChange(v: string) {
    setForm((p) => ({ ...p, phone: v }));
    if (phoneVerified) setPhoneVerified(false);
    if (codeSent) { setCodeSent(false); setLeft(0); }
  }

  async function sendCode() {
    if (form.phone.replace(/[^0-9]/g, "").length < 10) {
      alert("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/verify/phone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증번호 발송에 실패했어요."); return; }
      setCodeSent(true); setCode(""); setLeft(180);
    } finally { setSending(false); }
  }

  async function confirmCode() {
    if (code.trim().length < 4) { alert("인증번호를 입력해주세요."); return; }
    setVerifying(true);
    try {
      const res = await fetch("/api/verify/phone/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code: code.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증에 실패했어요."); return; }
      setPhoneVerified(true); setCodeSent(false); setLeft(0);
    } finally { setVerifying(false); }
  }

  async function handlePay() {
    // 비회원도 결제 가능 — 예약자 성함/연락처만 필수 (로그인 시 주문이 계정에 연결됨)
    if (!form.name || !form.phone) {
      alert("예약자 성함과 연락처를 입력해주세요.");
      return;
    }
    if (phoneVerifyEnabled && !phoneVerified) {
      alert("휴대폰 인증을 완료해주세요.");
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

          {/* 연락처 (+ 휴대폰 인증) */}
          {phoneVerifyEnabled ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={form.phone} onChange={(e) => onPhoneChange(e.target.value)}
                  placeholder="연락처 ( - 없이 숫자만 )" inputMode="numeric" disabled={phoneVerified}
                  className={inputCls} style={{ ...inputStyle, background: phoneVerified ? "var(--surface-soft)" : "#fff" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
                {phoneVerified ? (
                  <span className="shrink-0 px-4 flex items-center gap-1 rounded-xl text-sm font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>✓ 인증완료</span>
                ) : (
                  <button type="button" onClick={sendCode} disabled={sending}
                    className="shrink-0 px-4 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                    style={{ border: "1.5px solid var(--accent)", color: "var(--accent)", background: "#fff" }}>
                    {sending ? "발송 중…" : codeSent ? "재전송" : "인증번호 받기"}
                  </button>
                )}
              </div>
              {codeSent && !phoneVerified && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="인증번호 6자리" inputMode="numeric" maxLength={6}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
                    {left > 0 && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs tnum" style={{ color: "var(--sale)" }}>{mmss(left)}</span>}
                  </div>
                  <button type="button" onClick={confirmCode} disabled={verifying}
                    className="shrink-0 px-5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                    style={{ background: "var(--accent)" }}>
                    {verifying ? "확인 중…" : "확인"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <input value={form.phone} onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="연락처" className={inputCls} style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
          )}

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
        {phoneVerifyEnabled && !phoneVerified && (
          <p className="text-xs text-center mb-2" style={{ color: "var(--sale)" }}>📱 휴대폰 인증 후 결제할 수 있어요</p>
        )}
        <button onClick={handlePay} disabled={loading || (phoneVerifyEnabled && !phoneVerified)}
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
