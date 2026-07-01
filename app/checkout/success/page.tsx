"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface OrderResult {
  orderNumber: string;
  productName: string;
  totalAmount: number;
  paymentMethod: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const raw = sessionStorage.getItem("checkoutData");

    if (!paymentKey || !orderId || !amount || !raw) {
      setError("결제 정보를 찾을 수 없습니다.");
      return;
    }

    const checkoutData = JSON.parse(raw);

    fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
        checkoutData,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          sessionStorage.removeItem("checkoutData");
          setResult({
            orderNumber: data.orderNumber,
            productName: data.productName,
            totalAmount: data.totalAmount,
            paymentMethod: data.paymentMethod,
          });
        } else {
          setError(data.error || "결제 확인 중 오류가 발생했습니다.");
        }
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."));
  }, [searchParams]);

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>결제 오류</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{error}</p>
        <Link
          href="/campaigns"
          className="block w-full text-white text-sm font-semibold py-3 rounded-2xl"
          style={{ background: "var(--accent)" }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  if (!result) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>결제 확인 중...</p>;
  }

  return (
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
      <div className="text-center mb-6">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>결제 완료!</h1>
      </div>

      <div className="space-y-3 text-sm mb-6 tnum" style={{ color: "var(--text-secondary)" }}>
        <div className="flex justify-between">
          <span>주문번호</span>
          <span className="font-medium font-mono" style={{ color: "var(--text-primary)" }}>{result.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>상품</span>
          <span className="font-medium text-right max-w-[180px] truncate" style={{ color: "var(--text-primary)" }}>
            {result.productName}
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-3" style={{ borderTop: "1px solid var(--line)" }}>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>결제 금액</span>
          <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>
            {result.totalAmount.toLocaleString()}원
          </span>
        </div>
        <div className="flex justify-between">
          <span>결제 수단</span>
          <span style={{ color: "var(--text-secondary)" }}>{result.paymentMethod}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Link
          href="/campaigns"
          className="block w-full text-center text-white text-sm font-semibold py-3 rounded-2xl transition-all hover:brightness-95"
          style={{ background: "var(--accent)" }}
        >
          쇼핑 계속하기
        </Link>
        <Link
          href="/mypage"
          className="block w-full text-center text-sm font-medium py-3 rounded-2xl transition-all"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          마이페이지에서 확인
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
