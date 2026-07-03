import Header from "@/components/Header";
import HotelReserveClient from "@/components/HotelReserveClient";

export const metadata = {
  title: "여수 UTOP 마리나 호텔 공동구매 · BLEND PICK",
  description: "달력에서 패키지·날짜를 골라 예약하세요",
};

export default function HotelReservePage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <HotelReserveClient />
    </main>
  );
}
