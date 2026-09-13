import { SITES, type SiteKey } from "@/lib/sites";
export const SANJI_COLLECTIONS = {
  all:{title:"산지픽 상품 모아보기",description:"농산물과 수산물의 구성·가격·원산지·배송 조건을 비교하고 원하는 상품을 선택하세요."},
  produce:{title:"농산물 공동구매",description:"산지픽에 등록된 농산물을 모았습니다. 상품별 원산지, 중량과 구성, 보관 방법, 출고 일정을 확인하세요."},
  seafood:{title:"수산물 공동구매",description:"산지픽에 등록된 수산물을 모았습니다. 상품별 원산지, 규격, 냉장·냉동 여부와 배송 조건을 확인하세요."},
} as const;
export type SanjiCollection = keyof typeof SANJI_COLLECTIONS;
export function sanjiCollection(value:unknown):SanjiCollection {
  return typeof value==="string" && Object.prototype.hasOwnProperty.call(SANJI_COLLECTIONS,value) ? value as SanjiCollection:"all";
}
export function collectionPath(category?:string) { return "/products"+(category ? "?category="+encodeURIComponent(category):""); }
export function collectionMetadata(site:SiteKey,title:string,description:string,path:string,noindex=false) {
  const url="https://"+SITES[site].host+path;
  return {title:{absolute:title+" | "+SITES[site].name},description,alternates:{canonical:url},
    openGraph:{title,description,url},...(noindex ? {robots:{index:false,follow:false}}:{})};
}
