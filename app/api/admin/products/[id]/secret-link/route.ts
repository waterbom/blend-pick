import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import { sanjiSecretLinkUrl, validLinkPeriod, validLinkPrice } from "@/lib/secret-link";
async function handle(revoke: boolean, id: string, req: Request) {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token || !(await verifyAdminToken(token))) return NextResponse.json({error:"Unauthorized"},{status:401});
  const site = (await currentAdminSite()).key;
  if (site !== "sanjipick") return NextResponse.json({error:"산지픽에서 설정해주세요."},{status:404});
  const input = await req.json().catch(()=>({}));
  const scope = adminProductScopeSql(site, "category", 2);
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    const {rows} = await client.query(`SELECT * FROM products_shop WHERE id=$1 AND ${scope.sql} AND archived_at IS NULL FOR UPDATE`, [id,scope.param]);
    const p=rows[0];
    if (!p) { await client.query("ROLLBACK"); return NextResponse.json({error:"상품을 찾을 수 없습니다."},{status:404}); }
    if (Object.prototype.hasOwnProperty.call(input, 'expected_updated_at') && new Date(input.expected_updated_at).getTime() !== new Date(p.updated_at).getTime()) throw new Error('상품 또는 재고가 변경되었습니다. 새로고침 후 링크를 설정해주세요.');
    if (revoke) {
      await client.query("UPDATE product_secret_links SET revoked_at=COALESCE(revoked_at,NOW()) WHERE code=$1",[p.link_code]);
      const changed=await client.query("UPDATE products_shop SET link_code=NULL, updated_at=NOW() WHERE id=$1 RETURNING updated_at",[id]);
      await client.query("COMMIT"); return NextResponse.json({ok:true,updated_at:changed.rows[0].updated_at});
    }
    if (!validLinkPeriod(p.link_start_at,p.link_end_at) || new Date(p.link_end_at).getTime() <= Date.now()) throw new Error("저장된 링크 시작·종료 일시를 확인해주세요. 종료된 기간은 재발급할 수 없습니다.");
    const opts=await client.query("SELECT link_price, is_active FROM product_options WHERE product_id=$1 AND is_active=true AND removed_at IS NULL",[id]);
    if (opts.rows.length ? !opts.rows.some(o=>o.is_active && validLinkPrice(o.link_price)) : !validLinkPrice(p.link_price)) throw new Error("판매할 상품 또는 옵션의 비전시 가격을 먼저 저장해주세요.");
    const previous=await client.query("SELECT code,revoked_at FROM product_secret_links WHERE product_id=$1 AND starts_at=$2 AND ends_at=$3",[id,p.link_start_at,p.link_end_at]);
    let code=previous.rows[0]?.code;
    if (previous.rows[0]?.revoked_at) throw new Error("해제한 기간에는 다시 발급할 수 없습니다. 새 판매 기간을 설정해주세요.");
    if (!code) {
      const overlap=await client.query("SELECT 1 FROM product_secret_links WHERE product_id=$1 AND starts_at < $3 AND ends_at > $2 LIMIT 1",[id,p.link_start_at,p.link_end_at]);
      if (overlap.rows.length) throw new Error("이전에 발급한 기간과 겹칩니다. 겹치지 않는 새 기간을 설정해주세요.");
      code=randomBytes(16).toString("hex");
      await client.query("INSERT INTO product_secret_links(code,product_id,starts_at,ends_at) VALUES($1,$2,$3,$4)",[code,id,p.link_start_at,p.link_end_at]);
    }
    const changed=await client.query("UPDATE products_shop SET link_code=$2,updated_at=NOW() WHERE id=$1 RETURNING updated_at",[id,code]);
    await client.query("COMMIT");
    return NextResponse.json({ok:true,code,url:sanjiSecretLinkUrl(id,code),updated_at:changed.rows[0].updated_at});
  } catch(e) {
    await client.query("ROLLBACK");
    return NextResponse.json({error:e instanceof Error ? e.message : "링크 처리에 실패했습니다."},{status:409});
  } finally {client.release();}
}
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}) {return handle(false,(await params).id,_);}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}) {return handle(true,(await params).id,_);}
