import Link from "next/link";
import Header from "@/components/Header";
import HotelHeroBanner from "@/components/HotelHeroBanner";

export const metadata = {
  title: "호텔공구 · BLEND PICK",
  description: "인플루언서와 함께하는 호텔·리조트 공동구매",
};

export default function HotelPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      {/* 히어로 + 예약조회 오버레이 */}
      <div className="relative">
        <HotelHeroBanner />
        <Link href="/hotel/lookup"
          className="absolute top-4 right-4 z-30 flex items-center gap-1.5 rounded-full pl-3.5 pr-4 py-2 text-xs font-bold shadow-lg backdrop-blur-sm transition-transform active:scale-95"
          style={{ background: "rgba(255,255,255,0.92)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.6)" }}>
          🔎 예약 조회
        </Link>
      </div>

      {/* 이후 섹션(공구 목록 등)은 이어서 추가 예정 */}
      <div id="hotel-deals" />
    </main>
  );
}
