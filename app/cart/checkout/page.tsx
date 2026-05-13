import Header from "@/components/Header";
import CartCheckoutClient from "@/components/CartCheckoutClient";

export default function CartCheckoutPage() {
  const clientKey = process.env.TOSS_CLIENT_KEY!;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <CartCheckoutClient clientKey={clientKey} />
    </main>
  );
}
