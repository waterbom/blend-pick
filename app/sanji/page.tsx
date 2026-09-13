import SanjiHome from "@/components/sanji/SanjiHome";
import { getSanjiHomeReviews, getSanjiProducts } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 산지픽 메인 (sanjipick.blendpunch.com/) — 배너·대표 상품·한정특가·신상품·오픈 예정·후기.
// 카테고리 '산지픽' 상품으로 채워지고, 각 카드는 /p/<id> 판매 페이지로 간다. 상품이 없으면 판매 준비 안내.
export default async function SanjiRoot() {
  const [products, reviews, linkBase] = await Promise.all([getSanjiProducts(), getSanjiHomeReviews(), sanjiLinkBase()]);

  return (
    <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      {!products.length && <section data-storefront-state="empty" style={{padding:32,textAlign:"center"}}><h1>판매 준비 중입니다</h1><p>상품이 등록되면 이곳에서 확인하실 수 있어요.</p></section>}
      <nav aria-label="상품 카테고리" className="flex justify-center gap-4 py-3 text-sm">
        <a href={linkBase+"/products?category=produce"}>농산물 공동구매 →</a>
        <a href={linkBase+"/products?category=seafood"}>수산물 공동구매 →</a>
      </nav>
      <SanjiHome
        products={products}
        reviews={reviews}
        linkBase={linkBase}
        kakaoUrl={SITES.sanjipick.kakaoUrl}
      />
    </main>
  );
}
