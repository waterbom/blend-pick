import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import HotelCheckoutClient from "@/components/HotelCheckoutClient";
import { verifyToken } from "@/lib/auth";
import { PACKAGES, HOTEL, quoteReservation, stayBreakdown, saleStateFor, minBookableCheckIn } from "@/lib/hotel";
import { isStayAvailable, minRemainingForStay } from "@/lib/hotel-inventory";
import { phoneVerifyOn } from "@/lib/sms";
import pool from "@/lib/db";

export const metadata = { title: "예약 / 결제 · BLEND PICK" };

// 인플루언서 링크(?inf=) 검증 — 이름·일정은 DB에서만 신뢰
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

export default async function HotelCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pkg?: string; room?: string; in?: string; out?: string; inf?: string }>;
}) {
  const sp = await searchParams;
  const influencer = await getInfluencer(sp.inf);
  // 인플루언서 링크로 돌아갈 때 귀속(?inf=) 유지
  const backTo = `/hotel/reserve${sp.inf ? `?inf=${encodeURIComponent(sp.inf)}` : ""}`;

  // 인플루언서 전용 링크로만 구매 가능 — 직접 유입(유효한 인플루언서 없음)은 결제 진입 차단
  if (!influencer) redirect("/hotel/reserve");

  // 판매 오픈 전/마감이면 결제 진입 차단 — 인플루언서별 오픈 일정 반영
  if (saleStateFor(influencer) !== "open") redirect(backTo);

  const q = quoteReservation(sp.pkg ?? "", sp.room ?? "", sp.in ?? "", sp.out ?? "");
  if (!q) redirect(backTo);
  // 예약 컷오프 — 체크인 5일 전까지만 예약 가능 (호텔 블럭 해제 정책)
  if (q.checkIn < minBookableCheckIn()) redirect(backTo);
  // 실제 재고(마감) 확인 — 마감된 날짜면 결제 진입 차단
  if (!(await isStayAvailable(q.room, q.checkIn, q.nights))) redirect(backTo);

  const breakdown = stayBreakdown(q.pkg, q.checkIn, q.nights);
  const clientKey = process.env.TOSS_CLIENT_KEY!;
  // 마지막 남은 객실 안내 (기간 중 가장 적게 남은 밤 기준)
  const lastRoom = (await minRemainingForStay(q.room, q.checkIn, q.nights)) === 1;

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
        lastRoom={lastRoom}
      />
    </main>
  );
}
