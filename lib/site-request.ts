import { SITES, siteFromHost, type SiteKey } from "@/lib/sites";

// 라우트 핸들러(API)에서 요청이 어느 사이트에서 왔는지 — 주문 저장 시 orders.site 에 기록한다.
// 1) proxy.ts가 붙인 x-site 헤더 (산지픽 도메인, 또는 shop 도메인 /sanji 미리보기 쿠키)
// 2) 없으면 호스트로 판별
export function siteFromRequest(req: Request): SiteKey {
  const tagged = req.headers.get("x-site");
  if (tagged && tagged in SITES) return tagged as SiteKey;
  return siteFromHost(req.headers.get("host"));
}
