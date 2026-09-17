import { productSeo, productJsonLd, safeJsonLd, type SeoProduct, type SeoOption } from "@/lib/product-seo";
import { SITES, type SiteKey } from "@/lib/sites";
import { optionText } from "@/lib/buyer-flow";

export default function ProductSearchSummary({product, site, options = [], secret = false}: {product:SeoProduct;site:SiteKey;options?:SeoOption[];secret?:boolean}) {
 const seo=productSeo(product,site), data=productJsonLd(product,site,options,secret);
 const activeOptions=options.filter(o=>o.is_active);
 const facts=[{label:'원산지',value:seo.origin,icon:'◎'},{label:'브랜드',value:product.brand,icon:'✧'},{label:'배송',value:seo.shipping,icon:'↗'},{label:'출고 안내',value:seo.schedule,icon:'◷'}].filter(f=>f.value);
 return <section aria-label="상품 정보 요약" className={`product-summary ${site==='sanjipick'?'product-summary-sanji':''}`}>
  <div className="product-summary-title"><div><span>BEFORE YOU PICK</span><h2>구매 전, 꼭 확인해 주세요</h2></div><span className="product-summary-seal" aria-hidden="true">✓</span></div>
  <p className="product-summary-intro">{seo.text ? seo.text.slice(0,600) : '원산지부터 배송, 옵션별 구성까지 한눈에 확인하세요.'}</p>
  <dl className="product-facts">{facts.map(f=><div key={f.label}><dt><span aria-hidden="true">{f.icon}</span>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
  {!!activeOptions.length&&<div className="product-options-summary"><h3>옵션별 구성 <span>{activeOptions.length}가지</span></h3><ul>{activeOptions.map((o,i)=><li key={i}><span className="product-option-number">{String(i+1).padStart(2,'0')}</span><span>{optionText(o.name,o.value)}</span>{o.stock===0&&<small>품절</small>}</li>)}</ul></div>}
  <a className="product-summary-link" href={'https://'+SITES[site].host+'/products'}>다른 상품도 둘러보기 <span aria-hidden="true">↗</span></a>
  {data&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(data)}}/>}
 </section>;
}
