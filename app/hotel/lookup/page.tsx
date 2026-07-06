import Header from "@/components/Header";
import ReservationLookupClient from "@/components/ReservationLookupClient";

export const metadata = { title: "예약 조회 · BLEND PICK" };

export default function ReservationLookupPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <ReservationLookupClient />
    </main>
  );
}
