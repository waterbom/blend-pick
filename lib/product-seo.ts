import { SITES, type SiteKey } from "@/lib/sites";
import { shippingLabel } from "@/lib/shipping";
import { expectedShipLabel } from "@/lib/checkout-draft";

export interface SeoProduct {
  id?: string; name: string; brand?: string | null; category?: string | null;
  description?: string | null; origin_country?: string | null; origin?: string | null;
  price?: number | string | null; main_image?: string | null; is_visible?: boolean;
  status?: string; stock?: number; sale_start_at?: string | null; sale_end_at?: string | null;
  shipping_type?: string; shipping_cost?: number | null; free_shipping_threshold?: number | null;
  per_unit_shipping_cost?: number | null; island_shipping_cost?: number | null; installation_cost?: number | null;
  expected_ship_date?: string | null;
}
export interface SeoOption { name?: string; value?: string; extra_price: number; stock: number; is_active: boolean; }
export function plainText(value?: string | null): string {
  return String(value || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }).replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_, n: string) => ({nbsp:" ",amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[n.toLowerCase()] || " "))
    .replace(/\s+/g, " ").trim();
}
export function productSite(p: SeoProduct): SiteKey {
  return SITES.sanjipick.categories.includes(p.category || "") ? "sanjipick" : "blendpick";
}
export function productUrl(p: SeoProduct, site: SiteKey): string {
  return "https://" + SITES[site].host + (site === "sanjipick" ? "/p/" : "/products/") + encodeURIComponent(p.id || "");
}
export function productSeo(p: SeoProduct, site: SiteKey) {
  const name = plainText(p.name), brand = plainText(p.brand);
  const title = [name, brand && !name.includes(brand) ? brand : "", SITES[site].name].filter(Boolean).join(" | ");
  const text = plainText(p.description);
  const origin = plainText(p.origin_country || p.origin);
  const shipping = p.shipping_type ? shippingLabel({...p, shipping_type:p.shipping_type, shipping_cost:p.shipping_cost ?? 0}) : "";
  const facts = [name, origin ? "원산지 " + origin : "", text.slice(0, 160), shipping].filter(Boolean);
  const description = facts.join(" · ").slice(0, 230);
  const missing = [
    !name && "상품명을 입력해주세요.",
    !p.main_image && "대표 이미지를 등록해주세요.",
    text.length < 40 && "상세 페이지에 규격·구성·보관법 등 실제 상품 설명을 글로 보충해주세요.",
    site === "sanjipick" && !origin && "원산지를 입력해주세요.",
    !p.expected_ship_date && "출고 예정일을 확인해주세요.",
  ].filter((v): v is string => Boolean(v));
  return {title, description, text, origin, shipping, schedule:expectedShipLabel(p.expected_ship_date), missing};
}
export function imageUrl(value:string|null|undefined, base:string):string|undefined {
  if(!value) return undefined;
  try { const url=new URL(value,base); return ["https:","http:"].includes(url.protocol) ? url.href:undefined; } catch { return undefined; }
}
export function productMetadata(p: SeoProduct, site: SiteKey, secret = false) {
  const seo = productSeo(p, site), url = productUrl(p, site), image=imageUrl(p.main_image,productUrl(p,site));
  return { title:{absolute:seo.title}, description:seo.description, alternates:{canonical:url},
    ...((secret || p.is_visible !== true || !["active","soldout"].includes(p.status || "")) ? {robots:{index:false,follow:false}} : {}),
    openGraph:{title:seo.title,description:seo.description,url,images:image ? [{url:image}] : []},
    twitter:{card:"summary_large_image" as const,title:seo.title,description:seo.description,images:image ? [image] : []}
  };
}
export function productJsonLd(p: SeoProduct, site: SiteKey, options: SeoOption[] = [], secret = false, now = Date.now()) {
  if(secret || p.is_visible !== true || productSite(p)!==site || !["active","soldout"].includes(p.status || "")) return null;
  const seo=productSeo(p,site), url=productUrl(p,site), image=imageUrl(p.main_image,productUrl(p,site));
  const start=p.sale_start_at ? Date.parse(p.sale_start_at):null, end=p.sale_end_at ? Date.parse(p.sale_end_at):null;
  const open=p.status==="active" && typeof p.stock==="number" && p.stock!==0 && (start===null || start<=now) && (end===null || end>now);
  const active=options.filter(o=>o.is_active && Number.isFinite(Number(o.extra_price)) && Number(o.extra_price)>0);
  const offers=options.length ? (active.length ? {
    "@type":"AggregateOffer",priceCurrency:"KRW",lowPrice:Math.min(...active.map(o=>Number(o.extra_price))),
    highPrice:Math.max(...active.map(o=>Number(o.extra_price))),offerCount:active.length,url,
    availability:"https://schema.org/"+(open && active.some(o=>typeof o.stock==="number" && o.stock!==0) ? "InStock":"OutOfStock")
  }:undefined) : Number(p.price)>0 && Number.isFinite(Number(p.price)) ? {
    "@type":"Offer",priceCurrency:"KRW",price:Number(p.price),url,
    availability:"https://schema.org/"+(open ? "InStock":"OutOfStock")
  }:undefined;
  return {"@context":"https://schema.org","@type":"Product",name:plainText(p.name),description:seo.description,url,
    ...(image ? {image:[image]}:{}),
    ...(plainText(p.brand) ? {brand:{"@type":"Brand",name:plainText(p.brand)}}:{}),...(offers ? {offers}:{})};
}
export function safeJsonLd(value: unknown) { return JSON.stringify(value).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026"); }
