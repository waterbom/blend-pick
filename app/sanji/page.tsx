import SanjiSalesPage from "@/components/sanji/SanjiSalesPage";
import { getSanjiProducts, loadSanjiSalesPage, SANJI_DEMO } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 산지픽 루트 (sanjipick.blendpunch.com/) — 랜딩 없이 바로 판매 페이지.
// 카테고리 '산지픽' 상품 중 가장 최근 등록된 상품이 대표로 뜨고, 나머지는 "함께 본 상품"으로 깔린다.
// 아직 산지픽 상품이 없으면 예시 화면(구매 잠김)을 보여준다.
export default async function SanjiRoot({ searchParams }: { searchParams: Promise<{ inf?: string }> }) {
  const { inf } = await searchParams;
  const [list, linkBase] = await Promise.all([getSanjiProducts(), sanjiLinkBase()]);
  const featured = list.find((p) => p.status === "active" && p.stock > 0) ?? list[0];
  const data = featured ? await loadSanjiSalesPage(featured.id, inf) : null;
  const props = data ?? SANJI_DEMO;
  return (
    <main style={{ background: "#F2F2F2", minHeight: "100svh" }}>
      <SanjiSalesPage {...props} demo={!data} kakaoUrl={SITES.sanjipick.kakaoUrl} linkBase={linkBase} />
    </main>
  );
}
