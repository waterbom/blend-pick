import Header from "@/components/Header";
import StayBanner from "@/components/StayBanner";
import StayDealsSection from "@/components/StayDealsSection";
import { STAY_BANNERS } from "@/lib/stay-banners";

export const metadata = {
  title: "숙박공구 · BLEND PICK",
  description: "인플루언서와 함께하는 호텔·리조트 공동구매",
};

export default function HotelPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      {/* 숙소별 배너 섹션 — 세로로 쌓임. 새 숙소는 lib/stay-banners.ts에 항목만 추가 */}
      {STAY_BANNERS.map((b) => (
        <StayBanner key={b.key} slides={b.slides} />
      ))}

      {/* 숙소 카드 목록 — 새 호텔·펜션은 lib/stays.ts에 항목만 추가 */}
      <StayDealsSection />
    </main>
  );
}
