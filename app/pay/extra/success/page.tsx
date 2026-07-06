"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const sp = useSearchParams();
  const [state, setState] = useState<{ ok: boolean; orderNumber?: string; amount?: number; label?: string; error?: string } | null>(null);

  useEffect(() => {
    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amount = sp.get("amount");
    const raw = sessionStorage.getItem("extraPayData");
    if (!paymentKey || !orderId || !amount || !raw) {
      setState({ ok: false, error: "결제 정보를 찾을 수 없습니다." });
      return;
    }
    const cd = JSON.parse(raw);
    fetch("/api/payment/extra-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), ...cd }),
    })
      .then((r) => r.json())
      .then((d) => {
        setState(d);
        if (d.ok) sessionStorage.removeItem("extraPayData");
      })
      .catch(() => setState({ ok: false, error: "네트워크 오류가 발생했습니다." }));
  }, [sp]);

  if (!state) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>결제 확인 중...</p>;

  if (!state.ok) {
    return (
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{state.error}</p>
        <Link href="/" className="inline-block mt-5 text-xs" style={{ color: "var(--accent)" }}>← 홈으로</Link>
      </div>
    );
  }

  return (
    <div className="text-center max-w-sm w-full">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-soft)" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>결제가 완료됐어요</h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{state.label}</p>
      <div className="rounded-2xl p-5 mt-5" style={{ border: "1px solid var(--line)", background: "#fff" }}>
        <div className="flex justify-between text-sm mb-2"><span style={{ color: "var(--text-muted)" }}>결제번호</span><span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{state.orderNumber}</span></div>
        <div className="flex justify-between items-baseline"><span style={{ color: "var(--text-secondary)" }}>결제금액</span><span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{Number(state.amount).toLocaleString()}원</span></div>
      </div>
    </div>
  );
}

export default function ExtraPaySuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
