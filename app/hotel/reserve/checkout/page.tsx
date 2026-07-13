import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import HotelCheckoutClient from "@/components/HotelCheckoutClient";
import { verifyToken } from "@/lib/auth";
import { PACKAGES, HOTEL, quoteReservation, stayBreakdown, saleState } from "@/lib/hotel";
import { isStayAvailable } from "@/lib/hotel-inventory";
import { phoneVerifyOn } from "@/lib/sms";
import pool from "@/lib/db";

export const metadata = { title: "예약 / 결제 · BLEND PICK" };

// 인플루언서 링크(?inf=) 검증 — 이름은 DB에서만 신뢰
async function getInfluencer(inf?: string): Promise<{ id: string; name: string } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id, name FROM influencers WHERE id = $1", [inf]);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function HotelCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pkg?: string; room?: string; in?: string; out?: string; inf?: string }>;
}) {
  // 판매 오픈 전/마감이면 결제 진입 차단
  if (saleState() !== "open") redirect("/hotel/reserve");

  const sp = await searchParams;
  const q = quoteReservation(sp.pkg ?? "", sp.room ?? "", sp.in ?? "", sp.out ?? "");
  if (!q) redirect("/hotel/reserve");
  // 실제 재고(마감) 확인 — 마감된 날짜면 결제 진입 차단
  if (!(await isStayAvailable(q.room, q.checkIn, q.nights))) redirect("/hotel/reserve");

  const breakdown = stayBreakdown(q.pkg, q.checkIn, q.nights);
  const clientKey = process.env.TOSS_CLIENT_KEY!;
  const influencer = await getInfluencer(sp.inf);

  const token = (await cookies()).get("shop_token")?.value;
  const isLoggedIn = token ? !!(await verifyToken(token)) : false;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <HotelCheckoutClient
        clientKey={clientKey}
        isLoggedIn={isLoggedIn}
        phoneVerifyEnabled={phoneVerifyOn()}
        hotel={HOTEL}
        reservation={{
          pkg: q.pkg,
          room: q.room,
          checkIn: q.checkIn,
          checkOut: q.checkOut,
          nights: q.nights,
          total: breakdown.total,
          packageLabel: q.label,
          people: PACKAGES[q.pkg].people,
        }}
        breakdown={breakdown}
        influencerId={influencer?.id}
        influencerName={influencer?.name}
      />
    </main>
  );
}
