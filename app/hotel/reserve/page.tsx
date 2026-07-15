import Header from "@/components/Header";
import HotelReserveClient from "@/components/HotelReserveClient";
import { saleScheduleFor } from "@/lib/hotel";
import pool from "@/lib/db";

// 카카오톡 등 공유 시 미리보기 (오픈그래프) — 인플루언서 공유 링크에도 적용
export const metadata = {
  title: "여수 UTOP 마리나 호텔 공동구매 · BLEND PICK",
  description: "오션뷰 객실 · 조식 · 인피니티풀 · 레이트 체크아웃까지, 룸온리 요금으로 한 번에.",
  openGraph: {
    title: "여수 UTOP 마리나 호텔 공동구매 · BLEND PICK",
    description: "오션뷰 객실 · 조식 · 인피니티풀 · 레이트 체크아웃까지, 룸온리 요금으로 한 번에.",
    url: "https://shop.blendpunch.com/hotel/reserve",
    siteName: "BLEND PICK",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "https://shop.blendpunch.com/og-hotel.png", width: 1200, height: 630, alt: "여수 UTOP 마리나 호텔 오션뷰 객실" }],
  },
};

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 통과 (이름·일정은 DB에서만 신뢰)
async function getInfluencer(
  inf?: string
): Promise<{ id: string; name: string; start: string | null; deadline: string | null } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query(
      `SELECT id, name,
              to_char(hotel_sale_start AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS start,
              to_char(hotel_sale_deadline AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI:SS"+09:00"') AS deadline
         FROM influencers WHERE id = $1`,
      [inf]
    );
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
      <HotelReserveClient
        influencerId={influencer?.id}
        influencerName={influencer?.name}
        saleStart={saleScheduleFor(influencer).start}
        saleDeadline={saleScheduleFor(influencer).deadline}
      />
    </main>
  );
}
