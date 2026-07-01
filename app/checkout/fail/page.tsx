"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제가 취소되었습니다.";
  const code = searchParams.get("code");

  return (
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "var(--sale-soft)" }}
      >
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="var(--sale)" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </div>
      <h1 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>결제 실패</h1>
      <p className="text-sm mb-1" style={{ color: "var(--text-muted)" }}>{message}</p>
      {code && <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>오류 코드: {code}</p>}
      <div className="space-y-2 mt-6">
        <button
          onClick={() => window.history.back()}
          className="block w-full text-white text-sm font-semibold py-3 rounded-2xl transition-all hover:brightness-95"
          style={{ background: "var(--accent)" }}
        >
          다시 시도하기
        </button>
        <Link
          href="/campaigns"
          className="block w-full text-sm font-medium py-3 rounded-2xl transition-all"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutFailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <FailContent />
      </Suspense>
    </main>
  );
}
