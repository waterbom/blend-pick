import Header from "@/components/Header";
import HotelReserveClient from "@/components/HotelReserveClient";
import pool from "@/lib/db";

export const metadata = {
  title: "여수 UTOP 마리나 호텔 공동구매 · BLEND PICK",
  description: "달력에서 패키지·날짜를 골라 예약하세요",
};

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 통과 (이름은 DB에서만 신뢰)
async function getInfluencer(inf?: string): Promise<{ id: string; name: string } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id, name FROM influencers WHERE id = $1", [inf]);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function HotelReservePage({
  searchParams,
}: {
  searchParams: Promise<{ inf?: string }>;
}) {
  const { inf } = await searchParams;
  const influencer = await getInfluencer(inf);

  return (
    <main className="min-h-screen" style={{ background: "#FFFFFF" }}>
      {/* 딥 포레스트 리디자인 전용 폰트 (세리프 헤드라인 · 모노 카운트다운) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <Header />
      <HotelReserveClient influencerId={influencer?.id} influencerName={influencer?.name} />
    </main>
  );
}
