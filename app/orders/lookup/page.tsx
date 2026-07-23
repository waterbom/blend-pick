import Header from "@/components/Header";
import OrderLookupClient from "@/components/OrderLookupClient";

export const metadata = { title: "비회원 주문 조회 — BLEND PICK" };

export default function OrderLookupPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <OrderLookupClient />
    </main>
  );
}
