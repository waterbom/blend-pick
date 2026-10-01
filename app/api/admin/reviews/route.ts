import { withApiErrors, readJsonObject } from '@/lib/api-errors';
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 리뷰 목록 (관리자) — 최근순, 상품명 포함
async function handleGET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const r = await shopPool.query(
    `SELECT (SELECT rr.reply FROM review_replies rr WHERE rr.review_id=rv.id) AS seller_reply,rv.id, rv.product_id, rv.buyer_name, rv.rating, rv.content, rv.images, rv.is_hidden, rv.created_at,
            ps.name AS product_name, ps.product_code
       FROM reviews rv
       LEFT JOIN products_shop ps ON ps.id = rv.product_id
       JOIN orders o ON o.id = rv.order_id
      WHERE o.site = $1
      ORDER BY rv.created_at DESC
      LIMIT 300`, [site]
  );
  return NextResponse.json(r.rows);
}

// 숨김/해제
async function handlePATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { id, is_hidden } = await readJsonObject(req);
  if (!id || typeof is_hidden !== "boolean") {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const r = await shopPool.query(`UPDATE reviews SET is_hidden = $1 WHERE id = $2 AND order_id IN (SELECT id FROM orders WHERE site = $3)`, [is_hidden, id, site]);
  return NextResponse.json({ ok: true, updated: r.rowCount });
}

// 삭제
async function handleDELETE(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { id } = await readJsonObject(req);
  if (!id) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  const r = await shopPool.query(`DELETE FROM reviews WHERE id = $1 AND order_id IN (SELECT id FROM orders WHERE site = $2)`, [id, site]);
  return NextResponse.json({ ok: true, deleted: r.rowCount });
}

export const GET = withApiErrors('GET /api/admin/reviews', handleGET);
export const PATCH = withApiErrors('PATCH /api/admin/reviews', handlePATCH);
export const DELETE = withApiErrors('DELETE /api/admin/reviews', handleDELETE);
