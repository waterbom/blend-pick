"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface OrderResult {
  orderNumber: string;
  productName: string;
  totalAmount: number;
  shippingAddress: string;
  productId: string;
  campaignId: string | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
          setResult({
            orderNumber: data.orderNumber ?? "-",
            productName: data.productName,
            totalAmount: data.totalAmount,
            shippingAddress: checkoutData.shippingAddress ?? "",
            productId: checkoutData.productId,
            campaignId: checkoutData.campaignId ?? null,
          });
          sessionStorage.removeItem("checkoutData");
        } else {
          setError(data.error || "결제 확인 중 오류가 발생했습니다.");
        }
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."));
  }, [searchParams]);

  async function handleShare() {
    if (!result) return;
    // 인플루언서 공구 주문이면 전용 링크 공유 (공유로 유입된 구매도 같은 인플루언서에게 귀속)
    const url = result.campaignId
      ? `${window.location.origin}/c/${result.campaignId}`
      : `${window.location.origin}/campaigns/${result.productId}`;
    const shareData = {
      title: "블랜드픽 공동구매",
      text: `${result.productName} 공동구매 같이 참여해요!`,
      url,
    };
    // 모바일: OS 기본 공유 시트(카톡/링크복사 등) / 미지원: 링크 복사 폴백
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* 사용자가 공유를 취소한 경우 무시 */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert(url);
      }
    }
  }

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
    <div className="bg-white rounded-3xl p-7 max-w-sm w-full" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
      {/* 아이콘 + 타이틀 */}
      <div className="text-center mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="7" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>공구 참여 완료!</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          주문번호 <span className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>{result.orderNumber}</span>
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          공구 마감 후 순차 발송됩니다 (결제 후 3~7일)
        </p>
      </div>

      {/* 요약 박스 */}
      <div className="rounded-2xl p-4 space-y-2.5 mb-4" style={{ background: "var(--surface-soft)" }}>
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>상품</span>
          <span className="text-sm font-bold text-right truncate" style={{ color: "var(--text-primary)" }}>{result.productName}</span>
        </div>
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>결제금액</span>
          <span className="text-sm font-bold tnum" style={{ color: "var(--text-primary)" }}>{result.totalAmount.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between items-baseline gap-3">
          <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>배송지</span>
          <span className="text-sm font-bold text-right truncate" style={{ color: "var(--text-primary)" }}>{result.shippingAddress || "-"}</span>
        </div>
      </div>

      {/* 알림 안내 */}
      <p className="text-xs text-center mb-6" style={{ color: "var(--text-muted)" }}>
        📮 배송 시작 시 카카오톡으로 알려드려요
      </p>

      {/* 버튼 */}
      <div className="space-y-2.5">
        <Link
          href="/mypage"
          className="block w-full text-center text-white text-sm font-bold py-4 rounded-2xl transition-all hover:brightness-95"
          style={{ background: "var(--accent)" }}
        >
          주문 상세 보기
        </Link>
        <button
          onClick={handleShare}
          className="block w-full text-center text-sm font-bold py-4 rounded-2xl transition-all hover:bg-gray-50"
          style={{ border: "1.5px solid var(--line)", color: "var(--text-secondary)" }}
        >
          {copied ? "링크가 복사되었어요 ✓" : "이 공구 친구에게 공유"}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
      <Suspense fallback={<p className="text-sm" style={{ color: "var(--text-muted)" }}>로딩 중...</p>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
