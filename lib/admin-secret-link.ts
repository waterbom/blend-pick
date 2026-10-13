import type { PoolClient } from "pg";
import { validLinkPeriod, validLinkPrice } from "@/lib/secret-link";
export function linkSettingsError(body: Record<string, any>): string | null {
  if (body.link_price != null && body.link_price !== "" && !validLinkPrice(body.link_price)) return "비전시 가격은 0 이상의 정수로 입력해주세요.";
  if (Array.isArray(body.options) && body.options.some((o: any) => o.link_price != null && o.link_price !== "" && !validLinkPrice(o.link_price))) return "옵션 비전시 가격을 확인해주세요.";
  if ((body.link_start_at || body.link_end_at) && !validLinkPeriod(body.link_start_at, body.link_end_at)) return "링크 시작·종료 일시를 확인해주세요.";
  // Stop an unusable secret link BEFORE committing product/option changes.
  // The client sets revoke_link=false only when secret-link selling is enabled.
  if (body.revoke_link === false) {
    if (!validLinkPeriod(body.link_start_at, body.link_end_at)) return "비전시 링크의 시작·종료 시간을 입력해주세요.";
    const active = Array.isArray(body.options) ? body.options.filter((o: any) => o?.name && o.active !== false) : [];
    if (active.length && !active.some((o: any) => validLinkPrice(o.link_price))) {
      return "옵션 상품의 비전시 가격이 없습니다. 해결방법: '비전시 링크 > 옵션별 판매가격'에서 판매 중인 옵션 하나 이상에 가격을 입력한 뒤 저장해주세요.";
    }
    if (!active.length && !validLinkPrice(body.link_price)) {
      return "비전시 가격이 없습니다. 해결방법: '비전시 링크 > 링크가격'에 가격을 입력한 뒤 저장해주세요.";
    }
  }
  return null;
}
export async function saveLinkSettings(client: PoolClient, id: string, body: Record<string, any>) {
  const { rows } = await client.query("SELECT link_code, link_start_at, link_end_at FROM products_shop WHERE id=$1 FOR UPDATE", [id]);
  const old = rows[0];
  if (!old) throw new Error("상품을 찾을 수 없습니다.");
  const start = body.link_start_at === undefined ? old.link_start_at : body.link_start_at || null;
  const end = body.link_end_at === undefined ? old.link_end_at : body.link_end_at || null;
  const changed = String(start ? new Date(start).toISOString() : "") !== String(old.link_start_at ? new Date(old.link_start_at).toISOString() : "") || String(end ? new Date(end).toISOString() : "") !== String(old.link_end_at ? new Date(old.link_end_at).toISOString() : "");
  // A different window receives a different token. An expired URL never comes back to life.
  if (old.link_code && (changed || body.revoke_link)) {
    await client.query("UPDATE product_secret_links SET revoked_at=COALESCE(revoked_at,NOW()) WHERE code=$1", [old.link_code]);
    await client.query("UPDATE products_shop SET link_code=NULL WHERE id=$1", [id]);
  }
  await client.query("UPDATE products_shop SET link_start_at=$2, link_end_at=$3 WHERE id=$1", [id, start, end]);
}
