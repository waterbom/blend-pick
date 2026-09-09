import SanjiCatalog from "@/components/sanji/SanjiCatalog";
import { getSanjiProducts } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "전체 상품 · 검색" };

// 산지픽 전체 상품 / 검색 — sanjipick.blendpunch.com/products (shop 도메인에선 /sanji/products).
// 블랜드픽 /products 와 달리 산지픽 카테고리 상품만 보여준다.
export default async function SanjiProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, products, linkBase] = await Promise.all([searchParams, getSanjiProducts(), sanjiLinkBase()]);
  return (
    <main style={{ background: "#EFE9DC", minHeight: "100svh" }}>
      {!products.length && <p data-storefront-state="empty" style={{padding:24}}>판매 준비 중입니다. 등록된 상품이 없습니다.</p>}
      <SanjiCatalog products={products} linkBase={linkBase} initialQuery={q || ""} />
    </main>
  );
}
