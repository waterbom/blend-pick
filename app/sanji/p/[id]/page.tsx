import { cleanLinkCode, linkApplies } from "@/lib/secret-link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SanjiSalesPage from "@/components/sanji/SanjiSalesPage";
import { getSanjiProduct, loadSanjiSalesPage } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

type Search = { inf?: string; k?: string };

// 산지픽 개별 상품 판매 페이지 — sanjipick.blendpunch.com/p/<id> (shop 도메인에선 /sanji/p/<id>)
// ?k=<코드> 는 비밀링크 — 상품 관리에서 발급한 코드와 맞으면 링크가(link_price)로 판매
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }): Promise<Metadata> {
  const { id } = await params;
  const { k } = await searchParams;
  if (id.startsWith("demo")) return {title:"상품을 찾을 수 없습니다",robots:{index:false,follow:false}};
  const p = await getSanjiProduct(id).catch(() => null);
  if (!p || (k !== undefined && !linkApplies(p, cleanLinkCode(k))) || (k === undefined && p.is_visible === false)) return {title:"잘못된 요청입니다",robots:{index:false,follow:false}};
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
  if (id.startsWith("demo")) notFound();
  const [data, linkBase] = await Promise.all([loadSanjiSalesPage(id, inf, k), sanjiLinkBase()]);
  if (!data) notFound();
  return (
    <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      <SanjiSalesPage {...data} kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={linkBase} />
    </main>
  );
}
