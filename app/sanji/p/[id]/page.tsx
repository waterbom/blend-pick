import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SanjiSalesPage from "@/components/sanji/SanjiSalesPage";
import { getSanjiProduct, loadSanjiSalesPage } from "@/lib/sanji-data";
import { SANJI_DEMO_CARDS, demoById } from "@/lib/sanji-demo";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

type Search = { inf?: string; k?: string };

// 산지픽 개별 상품 판매 페이지 — sanjipick.blendpunch.com/p/<id> (shop 도메인에선 /sanji/p/<id>)
// ?k=<코드> 는 비밀링크 — 상품 관리에서 발급한 코드와 맞으면 링크가(link_price)로 판매
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { id } = await params;
  const { k } = await searchParams;
  if (id.startsWith("demo")) return { title: demoById(id).product.name };
  const p = await getSanjiProduct(id).catch(() => null);
  if (!p) return {};
  const S = SITES.sanjipick;
  // 비전시 상품·비밀링크 주소는 검색엔진에 안 실리게 (링크를 받은 사람만 보는 페이지)
  const secret = !p.is_visible || !!k;
  return {
    title: p.name,
    description: `${p.name} — ${p.price.toLocaleString()}원 · 산지 직송 특가`,
    ...(secret ? { robots: { index: false, follow: false } } : {}),
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
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const { inf, k } = await searchParams;
  // 메인 예시 카드(demo-*)에서 들어온 경우 — 예시 판매 페이지 (구매 잠김)
  if (id.startsWith("demo")) {
    const d = demoById(id);
    const data = {
      product: d.product,
      images: d.images,
      options: d.options,
      reviews: { total: 0, average: 0, list: [] },
      stats: { buyers: 0, sold: d.sold, rebuyers: 0 },
      others: SANJI_DEMO_CARDS.filter((c) => c.id !== d.product.id),
      influencerId: null,
      linkCode: null,
      linkDelta: 0,
    };
    return (
      <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
        <SanjiSalesPage {...data} demo kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={await sanjiLinkBase()} />
      </main>
    );
  }
  const [data, linkBase] = await Promise.all([loadSanjiSalesPage(id, inf, k), sanjiLinkBase()]);
  if (!data) notFound();
  return (
    <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      <SanjiSalesPage {...data} kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={linkBase} />
    </main>
  );
}
