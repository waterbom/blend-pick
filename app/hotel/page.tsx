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
      <HotelHeroBanner />

      {/* 예약 조회 안내 */}
      <div className="max-w-2xl mx-auto px-5 py-5">
        <Link href="/hotel/lookup"
          className="flex items-center justify-between rounded-2xl px-5 py-4 transition-transform active:scale-[0.99]"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>🔎 예약 조회</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>비회원도 예약번호로 예약을 확인할 수 있어요</p>
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>바로가기 →</span>
        </Link>
      </div>

      {/* 이후 섹션(공구 목록 등)은 이어서 추가 예정 */}
      <div id="hotel-deals" />
    </main>
  );
}
