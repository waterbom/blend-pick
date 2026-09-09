import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { currentSite } from "@/lib/site-server";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload ?? null;
}

// GET /api/cart — 장바구니 목록
export async function GET() {
  const site = (await currentSite()).key;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await shopPool.query(
    `SELECT c.id, c.quantity,
            p.id AS product_id, p.name, p.brand, p.price, p.main_image, p.shipping_type, p.shipping_cost,
            p.free_shipping_threshold, p.per_unit_shipping_cost, p.status, p.stock,
            p.supplier_name,p.release_address,p.shipping_carrier,
            o.id AS option_id, o.name AS option_name, o.value AS option_value, o.extra_price
     FROM cart c
     JOIN products_shop p ON p.id = c.product_id
     LEFT JOIN product_options o ON o.id = c.option_id
     WHERE c.user_id = $1 AND c.site = $2
     ORDER BY c.created_at DESC`,
    [user.id, site]
  );
  return NextResponse.json({ items: result.rows });
}

// POST /api/cart — 장바구니 담기
export async function POST(request: Request) {
  const site = (await currentSite()).key;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, option_id, quantity = 1 } = await request.json();
  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  if (!Number.isSafeInteger(quantity) || quantity < 1) return NextResponse.json({ error: "invalid quantity" }, { status: 400 });
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    // 옵션 없는 상품도 중복 행 생성 없이 증가시킨다.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cart:${site}:${user.id}:${product_id}:${option_id ?? ''}`]);
    const existing = await client.query(
      "SELECT id FROM cart WHERE user_id = $1 AND product_id = $2 AND option_id IS NOT DISTINCT FROM $3::uuid AND site = $4 LIMIT 1",
      [user.id, product_id, option_id ?? null, site]
    );
    if (existing.rows[0]) {
      await client.query("UPDATE cart SET quantity = quantity + $1 WHERE id = $2 AND site = $3 AND user_id = $4", [quantity, existing.rows[0].id, site, user.id]);
    } else {
      await client.query("INSERT INTO cart (user_id, product_id, option_id, quantity, site) VALUES ($1, $2, $3, $4, $5)", [user.id, product_id, option_id ?? null, quantity, site]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  return NextResponse.json({ ok: true });
}

// PATCH /api/cart — 수량 변경
export async function PATCH(request: Request) {
  const site = (await currentSite()).key;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cart_id, quantity } = await request.json();
  if (!cart_id || !Number.isSafeInteger(quantity) || quantity < 1) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await shopPool.query(
    `UPDATE cart SET quantity = $1 WHERE id = $2 AND user_id = $3 AND site = $4`,
    [quantity, cart_id, user.id, site]
  );
  if (!result.rowCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/cart — 항목 삭제
export async function DELETE(request: Request) {
  const site = (await currentSite()).key;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cart_id } = await request.json();
  const result = await shopPool.query(
    `DELETE FROM cart WHERE id = $1 AND user_id = $2 AND site = $3`,
    [cart_id, user.id, site]
  );
  if (!result.rowCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
