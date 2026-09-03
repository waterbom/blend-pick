import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SanjiSalesPage from "@/components/sanji/SanjiSalesPage";
import { getSanjiProduct, loadSanjiSalesPage, SANJI_DEMO, SANJI_DEMO_CARDS } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 산지픽 개별 상품 판매 페이지 — sanjipick.blendpunch.com/p/<id> (shop 도메인에선 /sanji/p/<id>)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (id.startsWith("demo")) return { title: "예시 상품" };
  const p = await getSanjiProduct(id).catch(() => null);
  if (!p) return {};
  const S = SITES.sanjipick;
  return {
    title: p.name,
    description: `${p.name} — ${p.price.toLocaleString()}원 · 산지 직송 특가`,
    openGraph: {
      title: `${p.name} · ${S.name}`,
      description: `${p.price.toLocaleString()}원 · 산지에서 바로, 제철 그대로`,
      images: p.main_image ? [{ url: p.main_image }] : undefined,
    },
  };
}

export default async function SanjiProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ inf?: string }>;
}) {
  const { id } = await params;
  const { inf } = await searchParams;
  // 메인 예시 카드(demo-*)에서 들어온 경우 — 예시 판매 페이지 (구매 잠김)
  if (id.startsWith("demo")) {
    const card = SANJI_DEMO_CARDS.find((c) => c.id === id) ?? SANJI_DEMO_CARDS[0];
    const data = { ...SANJI_DEMO, product: { ...SANJI_DEMO.product, ...card, description: null }, images: [card.main_image!], others: SANJI_DEMO_CARDS.filter((c) => c.id !== card.id) };
    return (
      <main style={{ background: "#F2F2F2", minHeight: "100svh" }}>
        <SanjiSalesPage {...data} demo kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={await sanjiLinkBase()} />
      </main>
    );
  }
  const [data, linkBase] = await Promise.all([loadSanjiSalesPage(id, inf), sanjiLinkBase()]);
  if (!data) notFound();
  return (
    <main style={{ background: "#F2F2F2", minHeight: "100svh" }}>
      <SanjiSalesPage {...data} kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={linkBase} />
    </main>
  );
}
