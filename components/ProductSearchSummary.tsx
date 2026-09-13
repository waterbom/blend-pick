import { productSeo, productJsonLd, productUrl, safeJsonLd, type SeoProduct, type SeoOption } from "@/lib/product-seo";
import { SITES, type SiteKey } from "@/lib/sites";

export default function ProductSearchSummary({product, site, options = [], secret = false}: {product:SeoProduct;site:SiteKey;options?:SeoOption[];secret?:boolean}) {
  const seo=productSeo(product,site), data=productJsonLd(product,site,options,secret);
  return <section aria-label="상품 정보 요약" className="mx-auto px-4 py-6" style={{maxWidth:site==="sanjipick"?480:1024}}>
    <h2 className="text-lg font-bold mb-3">구매 전 상품 정보</h2>
    <p className="mb-3 leading-relaxed">{seo.text ? seo.text.slice(0,600) : product.name+"의 구성과 옵션을 확인하고 선택해주세요."}</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {seo.origin && <><dt>원산지</dt><dd>{seo.origin}</dd></>}
      {product.brand && <><dt>브랜드</dt><dd>{product.brand}</dd></>}
      {seo.shipping && <><dt>배송</dt><dd>{seo.shipping}</dd></>}
      <dt>출고</dt><dd>{seo.schedule}</dd>
      {!!options.filter(o=>o.is_active).length && <><dt>선택 옵션</dt><dd>{options.filter(o=>o.is_active).map(o=>[o.name,o.value].filter(Boolean).join(" ")).join(" / ")}</dd></>}
    </dl>
    <a className="inline-block mt-4 underline text-sm" href={"https://"+SITES[site].host+"/products"}>다른 상품 둘러보기 →</a>
    {data && <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(data)}}/>}
  </section>;
}
