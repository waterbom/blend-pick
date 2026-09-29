"use client";
import { apiErrorMessage, readApiJson } from "@/lib/api-error-message";
import { readCheckoutSession, clearCheckoutSession, PAYMENT_CONNECTION_MESSAGE } from "@/lib/payment-client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trackPurchase } from "@/lib/analytics";

interface OrderResult {
  orderNumber: string;
  productName: string;
  totalAmount: number;
  paymentMethod: string;
}

function ShopSuccessContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const raw = readCheckoutSession("checkoutData");

    if (!paymentKey || !orderId || !amount || !raw) {
      setError("이 브라우저에서 결제 정보를 읽지 못했습니다. 다시 결제하지 말고 주문 내역을 확인해주세요. (오류 CHECKOUT_CONTEXT_MISSING)");
      return;
    }

    const checkoutData = raw;

    fetch("/api/payment/shop-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), checkoutData }),
    })
      .then(readApiJson)
      .then((data) => {
        if (data.ok) {
          clearCheckoutSession("checkoutData");
          setResult(data);
          // 메타 광고 전환 — 결제 완료(Purchase) 이벤트
          trackPurchase("shop", orderId, data.totalAmount, data.pixelItems);
        } else {
          setError(apiErrorMessage(data, "결제 확인 중 오류가 발생했습니다."));
        }
      })
      .catch(() => setError(PAYMENT_CONNECTION_MESSAGE));
  }, [searchParams]);

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm" style={{ border: "1px solid var(--line)" }}>
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>결제 오류</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{error}</p>
        <Link href="/products" className="block w-full text-white text-sm font-medium py-3 rounded-xl" style={{ background: "var(--accent)" }}>
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  if (!result) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>결제 확인 중...</p>;
  }

  return (
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-sm" style={{ border: "1px solid var(--line)" }}>
      <div className="text-center mb-6">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>결제 완료!</h1>
      </div>

      <div className="space-y-3 text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        <div className="flex justify-between">
          <span>주문번호</span>
          <span className="font-medium font-mono" style={{ color: "var(--text-primary)" }}>{result.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>상품</span>
          <span className="font-medium text-right max-w-[180px] truncate" style={{ color: "var(--text-primary)" }}>{result.productName}</span>
        </div>
        <div className="flex justify-between items-baseline tnum" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.75rem" }}>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>결제 금액</span>
          <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{result.totalAmount.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span>결제 수단</span>
          <span>{result.paymentMethod}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Link href="/products" className="block w-full text-center text-white text-sm font-semibold py-3 rounded-xl transition-all" style={{ background: "var(--accent)" }}>
          쇼핑 계속하기
        </Link>
        <Link href="/mypage" className="block w-full text-center text-sm font-medium py-3 rounded-xl transition-all" style={{ background: "var(--cream-dark)", color: "var(--text-secondary)" }}>
          마이페이지에서 확인
        </Link>
      </div>
    </div>
  );
}

export default function ShopSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <ShopSuccessContent />
      </Suspense>
    </main>
  );
}
