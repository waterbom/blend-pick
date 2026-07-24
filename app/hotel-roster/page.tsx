import Header from "@/components/Header";
import HotelRosterClient from "@/components/admin/HotelRosterClient";

export const metadata = { title: "호텔 명단 업데이트 — BLEND PICK" };

export default function HotelRosterPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <HotelRosterClient />
      </div>
    </main>
  );
}
