import Header from "@/components/Header";
import StayBanner from "@/components/StayBanner";
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
      {STAY_BANNERS.map((b, i) => (
        <div key={b.key}>
          {/* 배너 사이 구분 밴드 — 여백 + 헤어라인 + 다음 숙소 이름 */}
          {i > 0 && (
            <div className="py-14 sm:py-20" style={{ background: "var(--background)" }}>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-4 sm:gap-6">
                <span aria-hidden className="h-px flex-1" style={{ background: "#E4E1D6" }} />
                <span
                  className="shrink-0 text-[10px] sm:text-[11px] uppercase"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 500,
                    letterSpacing: ".28em",
                    color: "#9AA391",
                  }}
                >
                  {String(i + 1).padStart(2, "0")} · {b.name}
                </span>
                <span aria-hidden className="h-px flex-1" style={{ background: "#E4E1D6" }} />
              </div>
            </div>
          )}
          <StayBanner slides={b.slides} />
        </div>
      ))}

    </main>
  );
}
