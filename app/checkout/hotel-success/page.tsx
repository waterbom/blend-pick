"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Result {
  orderNumber: string;
  productName: string;
  stay: string;
  total: number;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const raw = sessionStorage.getItem("hotelCheckoutData");
    if (!paymentKey || !orderId || !amount || !raw) {
      setError("결제 정보를 찾을 수 없습니다.");
      return;
    }
    const checkoutData = JSON.parse(raw);
    fetch("/api/payment/hotel-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), checkoutData }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          sessionStorage.removeItem("hotelCheckoutData");
          setResult({ orderNumber: data.orderNumber, productName: data.productName, stay: data.stay, total: data.total });
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
        <Link href="/hotel/reserve" className="block w-full text-white text-sm font-semibold py-3 rounded-2xl" style={{ background: "var(--accent)" }}>다시 예약하기</Link>
      </div>
    );
  }
  if (!result) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>결제 확인 중...</p>;

  return (
    <div className="bg-white rounded-3xl p-7 max-w-sm w-full" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-soft)" }}>
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>예약 완료!</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          주문번호 <span className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>{result.orderNumber}</span>
        </p>
      </div>

      <div className="rounded-2xl p-4 space-y-2.5 mb-6" style={{ background: "var(--surface-soft)" }}>
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>숙소</span>
          <span className="text-sm font-bold text-right" style={{ color: "var(--text-primary)" }}>{result.productName}</span>
        </div>
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>투숙</span>
          <span className="text-sm font-bold tnum" style={{ color: "var(--text-primary)" }}>{result.stay}</span>
        </div>
        <div className="flex justify-between items-baseline gap-3 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
          <span className="text-sm font-bold shrink-0" style={{ color: "var(--text-primary)" }}>결제금액</span>
          <span className="text-lg font-extrabold tnum" style={{ color: "var(--accent)" }}>{result.total.toLocaleString()}원</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <Link href="/mypage" className="block w-full text-center text-white text-sm font-bold py-4 rounded-2xl transition-all hover:brightness-95" style={{ background: "var(--accent)" }}>주문 상세 보기</Link>
        <Link href="/hotel" className="block w-full text-center text-sm font-medium py-4 rounded-2xl transition-all" style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}>호텔공구 더 보기</Link>
      </div>
    </div>
  );
}

export default function HotelSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
