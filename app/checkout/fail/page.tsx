"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제가 취소되었습니다.";
  const code = searchParams.get("code");

  return (
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
      <div className="text-4xl mb-4">❌</div>
      <h1 className="text-lg font-bold text-gray-900 mb-2">결제 실패</h1>
      <p className="text-sm text-gray-500 mb-1">{message}</p>
      {code && <p className="text-xs text-gray-300 mb-6">오류 코드: {code}</p>}
      <div className="space-y-2 mt-6">
        <button
          onClick={() => window.history.back()}
          className="block w-full bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          다시 시도하기
        </button>
        <Link
          href="/campaigns"
          className="block w-full bg-gray-50 text-gray-600 text-sm font-medium py-3 rounded-xl hover:bg-gray-100 transition-colors"
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutFailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <Suspense fallback={<p className="text-sm text-gray-400">로딩 중...</p>}>
        <FailContent />
      </Suspense>
    </main>
  );
}
