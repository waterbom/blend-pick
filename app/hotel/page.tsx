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
      <HotelHeroBanner />

      {/* 이후 섹션(공구 목록 등)은 이어서 추가 예정 */}
      <div id="hotel-deals" />
    </main>
  );
}
