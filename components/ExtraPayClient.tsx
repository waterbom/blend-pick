"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

export default function ExtraPayClient({
  clientKey, token, amount, label,
}: {
  clientKey: string;
  token: string;
  amount: number;
  label: string;
}) {
  const [form, setForm] = useState({ name: "", phone: "", memo: "" });
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (!form.name || !form.phone) {
      alert("성함과 연락처를 입력해주세요.");
      return;
    }
    setLoading(true);
    sessionStorage.setItem("extraPayData", JSON.stringify({ token, name: form.name, phone: form.phone, memo: form.memo, label }));
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
    <div className="max-w-sm w-full">
      <div className="text-center mb-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>BLEND PICK</p>
        <h1 className="text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>추가 결제</h1>
      </div>

      {/* 사과 안내 */}
      <div className="rounded-2xl px-5 py-4 mb-4" style={{ background: "#fff", border: "1px solid var(--line)" }}>
        <p className="text-sm font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>🙇 차액 발생에 대해 깊은 사과의 말씀을 드립니다.</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          요금 안내 과정에서 착오로 결제 차액이 발생하였습니다. 고객님께 불편을 드려 진심으로 죄송합니다.
          번거로우시겠지만 아래 금액으로 결제를 도와주시면 감사하겠습니다.
        </p>
      </div>

      {/* 결제 금액 */}
      <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "var(--accent-soft)" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-3xl font-extrabold mt-1" style={{ color: "var(--accent)" }}>{amount.toLocaleString()}원</p>
      </div>

      {/* 결제자 정보 */}
      <div className="bg-white rounded-2xl p-5 mb-4 space-y-2.5" style={{ border: "1px solid var(--line)" }}>
        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="성함 (예약자 성함)" className={inputCls} style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
        <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="연락처" inputMode="numeric" className={inputCls} style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
        <input value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
          placeholder="예약번호 등 메모 (선택)" className={inputCls} style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
      </div>

      <button onClick={handlePay} disabled={loading}
        className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all hover:brightness-95 disabled:opacity-50"
        style={{ background: "var(--accent)" }}>
        {loading ? "처리 중..." : `${amount.toLocaleString()}원 결제하기`}
      </button>
    </div>
  );
}
