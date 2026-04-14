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
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">결제 오류</h1>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <Link
          href="/products"
          className="block w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  if (!result) {
    return <p className="text-sm text-gray-400">결제 확인 중...</p>;
  }

  return (
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-sm border border-gray-100">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-xl font-bold text-gray-900">결제 완료!</h1>
      </div>

      <div className="space-y-3 text-sm mb-6">
        <div className="flex justify-between">
          <span className="text-gray-400">주문번호</span>
          <span className="font-medium text-gray-900">{result.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">상품</span>
          <span className="font-medium text-gray-900 text-right max-w-[180px] truncate">
            {result.productName}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">결제 금액</span>
          <span className="font-bold text-gray-900">
            {result.totalAmount.toLocaleString()}원
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">결제 수단</span>
          <span className="text-gray-700">{result.paymentMethod}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Link
          href="/products"
          className="block w-full text-center bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          쇼핑 계속하기
        </Link>
        <Link
          href="/mypage"
          className="block w-full text-center bg-gray-50 text-gray-600 text-sm font-medium py-3 rounded-xl hover:bg-gray-100 transition-colors"
        >
          마이페이지에서 확인
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Suspense fallback={<p className="text-sm text-gray-400">로딩 중...</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
