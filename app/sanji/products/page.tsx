import SanjiCatalog from "@/components/sanji/SanjiCatalog";
import { getSanjiProducts } from "@/lib/sanji-data";
import { sanjiLinkBase } from "@/lib/sanji-link";
import { SANJI_COLLECTIONS, sanjiCollection, collectionMetadata, collectionPath } from "@/lib/catalog-seo";

export const dynamic = "force-dynamic";
type Search={q?:string|string[];category?:string|string[]};
export async function generateMetadata({searchParams}:{searchParams:Promise<Search>}) {
  const search=await searchParams, key=sanjiCollection(search.category), copy=SANJI_COLLECTIONS[key];
  return collectionMetadata("sanjipick",copy.title,copy.description,collectionPath(key==="all"?undefined:key),
    search.q!==undefined || (search.category!==undefined && search.category!==key));
}
export default async function SanjiProductsPage({searchParams}:{searchParams:Promise<Search>}) {
  const [search, products, linkBase]=await Promise.all([searchParams,getSanjiProducts(),sanjiLinkBase()]);
  const category=sanjiCollection(search.category);
  const q=typeof search.q==="string" ? search.q.slice(0,200):"";
  return <main style={{background:"#EFE9DC",minHeight:"100svh"}}>
    {!products.length && <p data-storefront-state="empty" style={{padding:24}}>판매 준비 중입니다. 등록된 상품이 없습니다.</p>}
    <SanjiCatalog key={category+":"+q} products={products} linkBase={linkBase} initialQuery={q} initialCategory={category}/>
  </main>;
}
