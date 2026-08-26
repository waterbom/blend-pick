import Header from "@/components/Header";
import HotelHeroBanner from "@/components/HotelHeroBanner";
import StayDealsSection from "@/components/StayDealsSection";

export const metadata = {
  title: "숙박공구 · BLEND PICK",
  description: "인플루언서와 함께하는 호텔·리조트 공동구매",
};

export default function HotelPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      {/* 히어로 (예약조회는 /hotel/utop 히어로로 이동) */}
      <HotelHeroBanner />

      {/* 숙소 카드 목록 — 새 호텔·펜션은 lib/stays.ts에 항목만 추가 */}
      <StayDealsSection />
    </main>
  );
}
