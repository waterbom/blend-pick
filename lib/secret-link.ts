import { shopUnitPrice } from "@/lib/shop-price";
import { SITES } from "@/lib/sites";
export const LINK_PARAM = "k";
export const INVALID_LINK = "잘못된 요청입니다";
export interface LinkPriced {
  price: number; link_price?: number | null; link_code?: string | null;
  link_start_at?: string | Date | null; link_end_at?: string | Date | null;
}
export function cleanLinkCode(v: unknown): string | null {
  return typeof v === "string" && /^[a-z0-9]{8,32}$/.test(v) ? v : null;
}
export function validLinkPeriod(start: unknown, end: unknown): boolean {
  if (!start || !end) return false;
  const a = new Date(start as string).getTime(), b = new Date(end as string).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a < b;
}
export function validLinkPrice(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "" && typeof v !== "boolean" && Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 2147483647;
}
export function linkApplies(p: LinkPriced, code: string | null | undefined, now = Date.now()): boolean {
  return !!code && cleanLinkCode(code) === code && p.link_code === code && validLinkPeriod(p.link_start_at, p.link_end_at)
    && now >= new Date(p.link_start_at!).getTime() && now < new Date(p.link_end_at!).getTime();
}
// 옵션 가격은 절대 판매가. 비전시 옵션 가격을 비우면 해당 옵션을 판매하지 않는다.
export function secretUnitPrice(p: LinkPriced, option: { extra_price: number | null; link_price?: number | null } | null, linked: boolean): number | null {
  if (!linked) return shopUnitPrice(Number(p.price), option?.extra_price, !!option);
  const v = option ? option.link_price : p.link_price;
  return validLinkPrice(v) ? Number(v) : null;
}
export function sanjiSecretLinkUrl(productId: string, code: string): string {
  return `https://${SITES.sanjipick.host}/p/${productId}?${LINK_PARAM}=${code}`;
}
