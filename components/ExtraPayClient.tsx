"use client";

import { useSiteKey } from "@/components/SiteContext";
import { SITES } from "@/lib/sites";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { validateBuyerName } from "@/lib/validate-name";

// 딥 포레스트 팔레트 — 호텔 예약 페이지와 동일 토큰
const C = {
  green900: "#1C2418",
  green800: "#244B1F",
  mintOnDark: "#C7D6C0",
  surfaceSoft: "#F6F4EE",
  hairline: "#E4E1D6",
  muted: "#6B7263",
  muted3: "#8B927F",
  gold: "#E9C46A",
  terracotta: "#A65B4B",
} as const;
const SERIF = "'Noto Serif KR', serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export default function ExtraPayClient({
  clientKey, token, amount, label,
}: {
  clientKey: string;
  token: string;
  amount: number;
  label: string;
}) {
  const site = useSiteKey();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const p = phone.replace(/[^0-9]/g, "");
    if (p.length < 10) { alert("올바른 휴대폰 번호를 입력해주세요."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/verify/phone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증번호 발송에 실패했어요."); return; }
      setCodeSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (!code.trim()) { alert("인증번호를 입력해주세요."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/verify/phone/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증에 실패했어요."); return; }
      setVerified(true);
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    const nameErr = validateBuyerName(name);
    if (nameErr) { alert(nameErr); return; }
    if (!verified) { alert("휴대폰 번호 인증을 먼저 완료해주세요."); return; }
    setLoading(true);
    sessionStorage.setItem("extraPayData", JSON.stringify({ token, name: name.trim(), phone, label }));
    const orderId = crypto.randomUUID();
    try {
      const toss = await loadTossPayments(clientKey);
      const payment = toss.payment({ customerKey: "ANONYMOUS" });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amount },
        orderId,
        orderName: label,
        successUrl: `${window.location.origin}/pay/extra/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: name.trim(),
        customerMobilePhone: phone.replace(/-/g, ""),
      });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  const inputCls = "w-full px-4 py-3.5 text-sm focus:outline-none transition-colors";
  const inputStyle = { border: `1px solid ${C.hairline}`, background: "#fff", color: C.green900 };
  const focusOn = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = C.green800);
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = C.hairline);

  return (
    <div className="max-w-sm w-full">
      {/* 헤드라인 */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.28em] uppercase mb-2" style={{ fontFamily: MONO, color: C.muted3 }}>
          {SITES[site].nameEn} — PAYMENT
        </p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: C.green900 }}>추가 결제</h1>
        <div className="mt-4 h-px w-full" style={{ background: C.hairline }} />
      </div>

      {/* 결제 금액 — 다크 그린 패널 */}
      <div className="px-5 py-5 mb-4" style={{ background: C.green800 }}>
        <p className="text-xs" style={{ color: C.mintOnDark }}>{label}</p>
        <p className="text-3xl font-semibold mt-1.5" style={{ fontFamily: MONO, color: C.gold }}>
          {amount.toLocaleString()}<span className="text-base ml-0.5">원</span>
        </p>
      </div>

      {/* 결제자 정보 + 번호 인증 */}
      <div className="p-5 mb-4 space-y-2.5" style={{ background: "#fff", border: `1px solid ${C.hairline}` }}>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ fontFamily: MONO, color: C.muted3 }}>
          결제자 확인
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="성함 (예약자 성함)" className={inputCls} style={inputStyle}
          onFocus={focusOn} onBlur={focusOff} />
        <div className="flex gap-1.5">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={verified}
            placeholder="휴대폰 번호" inputMode="numeric" className={`${inputCls} flex-1 min-w-0 disabled:opacity-60`} style={inputStyle}
            onFocus={focusOn} onBlur={focusOff} />
          {!verified && (
            <button onClick={sendCode} disabled={busy}
              className="shrink-0 px-3.5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: C.green800 }}>
              {codeSent ? "재발송" : "인증번호 받기"}
            </button>
          )}
        </div>
        {codeSent && !verified && (
          <div className="flex gap-1.5">
            <input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="인증번호 6자리" inputMode="numeric" maxLength={6}
              className={`${inputCls} flex-1 min-w-0`} style={{ ...inputStyle, fontFamily: MONO }}
              onFocus={focusOn} onBlur={focusOff} />
            <button onClick={confirmCode} disabled={busy}
              className="shrink-0 px-5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: C.green800 }}>
              확인
            </button>
          </div>
        )}
        {verified && (
          <p className="text-xs font-semibold" style={{ color: C.green800 }}>✓ 휴대폰 인증 완료</p>
        )}
        {codeSent && !verified && (
          <p className="text-[11px]" style={{ color: C.muted }}>문자로 받은 인증번호를 3분 안에 입력해주세요.</p>
        )}
      </div>

      <button onClick={handlePay} disabled={loading || !verified || !name.trim()}
        className="w-full py-4 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-40"
        style={{ background: C.green800 }}>
        {loading ? "처리 중..." : (
          <>결제 진행 — <span style={{ fontFamily: MONO, color: C.gold }}>{amount.toLocaleString()}원</span></>
        )}
      </button>
      <p className="text-[11px] text-center mt-3" style={{ color: C.muted3 }}>
        본인 확인을 위해 휴대폰 인증 후 결제가 진행됩니다.
      </p>
    </div>
  );
}
