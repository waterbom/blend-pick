import { SITE_BADGE_CLS, siteLabel } from "@/lib/site-label";
import type { SiteKey } from "@/lib/sites";

// 주문이 어느 사이트에서 결제됐는지 — 기본은 산지픽일 때만 표시 (블랜드픽이 대부분이라 시끄럽지 않게), always 로 항상 표시
export default function SiteBadge({ site, always = false, className = "" }: { site: string | null | undefined; always?: boolean; className?: string }) {
  const key = ((site as SiteKey) || "blendpick") as SiteKey;
  if (!always && key === "blendpick") return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none align-middle ${SITE_BADGE_CLS[key] ?? SITE_BADGE_CLS.blendpick} ${className}`}>
      {siteLabel(key)}
    </span>
  );
}
