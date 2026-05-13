import Header from "@/components/Header";
import CartClient from "@/components/CartClient";

export default function CartPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <CartClient />
    </main>
  );
}
