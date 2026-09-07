import { headers } from "next/headers";
import { SITES, siteFromHost, type SiteKey } from "@/lib/sites";
import shopPool from "@/lib/db-shop";

// 관리자 범위는 접속 도메인으로 고정한다. site 쿼리·미리보기 쿠키로 바꿀 수 없다.
// 관리자 인증은 각 페이지/API가 기존 방식으로 별도 수행한다.
export async function currentAdminSite() {
  return SITES[siteFromHost((await headers()).get("host"))];
}

export async function adminOrderIdsBelong(ids: unknown[], site: SiteKey): Promise<boolean> {
  if (!ids.length || ids.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return false;
  const unique = [...new Set(ids)];
  const { rows } = await shopPool.query(
    "SELECT id FROM orders WHERE id = ANY($1::uuid[]) AND site = $2",
    [unique, site]
  );
  return rows.length === unique.length;
}
