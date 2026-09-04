import type { Metadata } from "next";
import Header from "@/components/Header";
import OrderLookupClient from "@/components/OrderLookupClient";
import { currentSite } from "@/lib/site-server";

// 비회원 주문 조회 — 제목은 접속한 사이트 브랜드로 (블랜드픽 / 산지픽)
export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite();
  return { title: `주문 조회 — ${site.nameEn}` };
}

export default function OrderLookupPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <OrderLookupClient />
    </main>
  );
}
