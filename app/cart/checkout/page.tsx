import Header from "@/components/Header";
import CartCheckoutClient from "@/components/CartCheckoutClient";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { phoneVerifyOn } from "@/lib/sms";
import { currentSite } from "@/lib/site-server";

export async function generateMetadata() {
  const site = await currentSite();
  return { title: { absolute: `주문 / 결제 · ${site.key === "sanjipick" ? "산지픽" : "블랜드픽"}` }, robots: { index: false, follow: false } };
}

export default async function CartCheckoutPage() {
  const clientKey = process.env.TOSS_CLIENT_KEY!;
  // 비회원(로그인 안 함)이면 휴대폰 인증 후 결제
  const shopToken = (await cookies()).get("shop_token")?.value;
  const loggedIn = shopToken ? !!(await verifyToken(shopToken)) : false;
  const phoneVerifyRequired = phoneVerifyOn() && !loggedIn;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <CartCheckoutClient clientKey={clientKey} phoneVerifyRequired={phoneVerifyRequired} />
    </main>
  );
}
