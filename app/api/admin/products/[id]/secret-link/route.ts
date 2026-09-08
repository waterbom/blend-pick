import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import { sanjiSecretLinkUrl } from "@/lib/secret-link";

// 상품 비밀링크 코드 발급/재발급/해제 — 상품 관리 수정 화면의 "비밀링크" 섹션이 호출한다.
//  POST   { regenerate?: boolean } → 코드가 없으면 새로 발급, regenerate=true 면 기존 코드를 버리고 새 코드 (옛 링크는 즉시 무효)
//  DELETE                          → 코드 해제 (링크가는 남지만 어떤 링크로도 적용 안 됨)
// 코드는 URL 에 그대로 실리는 비밀값이라 추측 불가능한 난수(16자 소문자+숫자)로 만든다.

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

function newCode(): string {
  // 16자 base36 — 랜덤 바이트를 36진수로 (약 83bit)
  const b = randomBytes(12);
  let s = "";
  for (const x of b) s += x.toString(36).padStart(2, "0");
  return s.replace(/[^a-z0-9]/g, "").slice(0, 16).padEnd(16, "0");
}

// 접속 도메인 범위(Shop/산지픽)의 상품만 다룬다 — 다른 사이트 상품 id 로는 404
async function scopedProduct(id: string) {
  const c = adminProductScopeSql((await currentAdminSite()).key, "category", 2);
  const r = await shopPool.query(
    `SELECT id, link_code, link_price FROM products_shop WHERE id = $1 AND ${c.sql}`,
    [id, c.param]
  );
  return r.rows[0] as { id: string; link_code: string | null; link_price: number | null } | undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const product = await scopedProduct(id);
  if (!product) return NextResponse.json({ error: "상품을 찾을 수 없어요." }, { status: 404 });

  let code = product.link_code;
  if (!code || body?.regenerate) {
    // 유니크 인덱스 충돌 시 한 번 더 시도
    for (let i = 0; i < 3; i++) {
      const candidate = newCode();
      try {
        await shopPool.query(`UPDATE products_shop SET link_code = $1, updated_at = NOW() WHERE id = $2`, [candidate, id]);
        code = candidate;
        break;
      } catch (e) {
        if (i === 2) throw e;
      }
    }
  }
  return NextResponse.json({ ok: true, code, url: sanjiSecretLinkUrl(id, code!), link_price: product.link_price });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await scopedProduct(id);
  if (!product) return NextResponse.json({ error: "상품을 찾을 수 없어요." }, { status: 404 });
  await shopPool.query(`UPDATE products_shop SET link_code = NULL, updated_at = NOW() WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
