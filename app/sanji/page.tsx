import SanjiHome from "@/components/sanji/SanjiHome";
import { getSanjiHomeReviews, getSanjiProducts, SANJI_DEMO_CARDS, SANJI_DEMO_REVIEWS } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SITES } from "@/lib/sites";

export const dynamic = "force-dynamic";

// 산지픽 메인 (sanjipick.blendpunch.com/) — 배너·대표 상품·한정특가·신상품·오픈 예정·후기.
// 카테고리 '산지픽' 상품으로 채워지고, 각 카드는 /p/<id> 판매 페이지로 간다. 상품이 없으면 예시 화면.
export default async function SanjiRoot() {
  const [products, reviews, linkBase] = await Promise.all([getSanjiProducts(), getSanjiHomeReviews(), sanjiLinkBase()]);
  const demo = products.length === 0;
  return (
    <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      <SanjiHome
        products={demo ? SANJI_DEMO_CARDS : products}
        reviews={demo ? SANJI_DEMO_REVIEWS : reviews}
        linkBase={linkBase}
        demo={demo}
        kakaoUrl={SITES.sanjipick.kakaoUrl}
      />
    </main>
  );
}
