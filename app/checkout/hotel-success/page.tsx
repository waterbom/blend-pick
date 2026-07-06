"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HOTEL } from "@/lib/hotel";

interface Result {
  orderNumber: string;
  total: number;
  room: string;
  checkIn: string;
  checkOut: string;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function fmt(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d} (${WEEK[new Date(y, m - 1, d).getDay()]})`;
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
    const cd = JSON.parse(raw);
    fetch("/api/payment/hotel-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), checkoutData: cd }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setResult({
            orderNumber: data.orderNumber,
            total: data.total,
            room: cd.room,
            checkIn: cd.checkIn,
            checkOut: cd.checkOut,
          });
          sessionStorage.removeItem("hotelCheckoutData");
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
    <div className="max-w-sm w-full">
      {/* 아이콘 + 타이틀 */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent-soft)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>예약이 확정됐어요!</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          예약번호 <span className="font-bold font-mono" style={{ color: "var(--text-primary)" }}>{result.orderNumber}</span>
        </p>
      </div>

      {/* 호텔 카드 */}
      <div className="rounded-2xl overflow-hidden mb-5" style={{ border: "1.5px dashed var(--line)" }}>
        <img src={HOTEL.image} alt="" className="w-full h-44 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="p-5 bg-white">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{HOTEL.tagline}</p>
          <p className="text-lg font-extrabold mt-0.5" style={{ color: "var(--text-primary)" }}>{HOTEL.name}</p>

          <div className="grid grid-cols-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {[
              { label: "체크인", value: fmt(result.checkIn), sub: HOTEL.checkInTime },
              { label: "체크아웃", value: fmt(result.checkOut), sub: HOTEL.checkOutTime },
              { label: "객실", value: result.room, sub: "" },
            ].map((c) => (
              <div key={c.label} className="text-center">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.label}</p>
                <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>{c.value}</p>
                {c.sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.sub}</p>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>결제금액</span>
            <span className="text-lg font-extrabold tnum" style={{ color: "var(--accent)" }}>{result.total.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold text-center" style={{ color: "var(--accent)" }}>📩 예약 확인 문자를 보내드렸어요</p>
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: "var(--accent-soft)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>🏨 체크인 시 호텔 프런트에</p>
          <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>예약 확인 문자를 보여주시면 입장 가능합니다</p>
        </div>
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>예약번호 · 예약자 성함으로 확인됩니다</p>
      </div>

      {/* 버튼 */}
      <div className="space-y-2.5">
        <Link href="/mypage" className="block w-full text-center text-white text-sm font-bold py-4 rounded-2xl transition-all hover:brightness-95" style={{ background: "var(--accent)" }}>예약 상세 보기</Link>
        <Link href="/mypage" className="block w-full text-center text-sm font-medium py-4 rounded-2xl transition-all" style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}>예약 내역으로</Link>
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
