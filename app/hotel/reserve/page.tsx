import Header from "@/components/Header";
import HotelReserveClient from "@/components/HotelReserveClient";
import pool from "@/lib/db";

export const metadata = {
  title: "여수 UTOP 마리나 호텔 공동구매 · BLEND PICK",
  description: "달력에서 패키지·날짜를 골라 예약하세요",
};

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 통과
async function validInfluencerId(inf?: string): Promise<string | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id FROM influencers WHERE id = $1", [inf]);
    return r.rows[0]?.id ?? null;
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
  const influencerId = await validInfluencerId(inf);

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <HotelReserveClient influencerId={influencerId} />
    </main>
  );
}
