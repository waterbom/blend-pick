import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Header from "@/components/Header";
import HotelCheckoutClient from "@/components/HotelCheckoutClient";
import { verifyToken } from "@/lib/auth";
import { PACKAGES, HOTEL, quoteReservation, stayBreakdown, saleState } from "@/lib/hotel";
import { isStayAvailable } from "@/lib/hotel-inventory";

export const metadata = { title: "예약 / 결제 · BLEND PICK" };

export default async function HotelCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pkg?: string; room?: string; in?: string; out?: string }>;
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

  const token = (await cookies()).get("shop_token")?.value;
  const isLoggedIn = token ? !!(await verifyToken(token)) : false;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <HotelCheckoutClient
        clientKey={clientKey}
        isLoggedIn={isLoggedIn}
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
      />
    </main>
  );
}
