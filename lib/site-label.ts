import type { SiteKey } from "@/lib/sites";

// 주문·문자 등에서 쓰는 사이트 표기 — orders.site 값 기준 (클라이언트에서도 import 가능, DB 의존 없음)
export const SITE_LABEL: Record<SiteKey, string> = { blendpick: "블랜드픽", sanjipick: "산지픽" };

// 어드민 배지 색 — 산지픽은 로고 그린, 블랜드픽은 중립
export const SITE_BADGE_CLS: Record<SiteKey, string> = {
  blendpick: "bg-slate-100 text-slate-500",
  sanjipick: "bg-[#E7EFE3] text-[#2F5D34]",
};

export function siteLabel(site: string | null | undefined): string {
  return SITE_LABEL[(site as SiteKey) || "blendpick"] ?? SITE_LABEL.blendpick;
}

// 문자 머리말 "[블랜드픽]" / "[산지픽]"
export function siteSmsTag(site: string | null | undefined): string {
  return `[${siteLabel(site)}]`;
}

export const SITE_FILTERS: { key: "" | SiteKey; label: string }[] = [
  { key: "", label: "전체" },
  { key: "blendpick", label: "블랜드픽" },
  { key: "sanjipick", label: "산지픽" },
];
