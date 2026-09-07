import { SITES, siteFromHost, type SiteKey } from "@/lib/sites";

// 라우트 핸들러(API)에서 요청이 어느 사이트에서 왔는지 — 주문 저장 시 orders.site 에 기록한다.
// 운영: 접속 호스트로 고정. 개발 환경에서만 x-site 미리보기 헤더 허용.
export function siteFromRequest(req: Request): SiteKey {
  if (process.env.NODE_ENV === "production") return siteFromHost(req.headers.get("host"));
  const tagged = req.headers.get("x-site");
  if (tagged && tagged in SITES) return tagged as SiteKey;
  return siteFromHost(req.headers.get("host"));
}
