import { headers } from "next/headers";
import { SITES, siteFromHost, siteFromPath, type SiteConfig, type SiteKey } from "@/lib/sites";

// 서버 컴포넌트에서 현재 요청이 어느 사이트인지 — proxy.ts가 붙인 x-site 헤더 우선,
// 없으면(프록시 미적용 경로 등) 호스트/경로로 판별
export async function currentSite(): Promise<SiteConfig> {
  let key: SiteKey = "blendpick";
  try {
    const h = await headers();
    const tagged = h.get("x-site") as SiteKey | null;
    if (tagged && tagged in SITES) key = tagged;
    else {
      key = siteFromHost(h.get("host"));
      if (key === "blendpick") key = siteFromPath(h.get("x-pathname") || "");
    }
  } catch {
    // headers() 사용 불가 컨텍스트(정적 렌더 등)면 기본 사이트
  }
  return SITES[key];
}
