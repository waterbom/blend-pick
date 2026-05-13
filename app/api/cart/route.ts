import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload ?? null;
}

// GET /api/cart — 장바구니 목록
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await shopPool.query(
    `SELECT c.id, c.quantity,
            p.id AS product_id, p.name, p.brand, p.price, p.main_image, p.shipping_type, p.shipping_cost, p.status, p.stock,
            o.id AS option_id, o.name AS option_name, o.value AS option_value, o.extra_price
     FROM cart c
     JOIN products_shop p ON p.id = c.product_id
     LEFT JOIN product_options o ON o.id = c.option_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [user.id]
  );
  return NextResponse.json({ items: result.rows });
}

// POST /api/cart — 장바구니 담기
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, option_id, quantity = 1 } = await request.json();
  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  // 이미 담겨있으면 수량 증가, 없으면 INSERT
  await shopPool.query(
    `INSERT INTO cart (user_id, product_id, option_id, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id, option_id)
     DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity`,
    [user.id, product_id, option_id ?? null, quantity]
  );
  return NextResponse.json({ ok: true });
}

// PATCH /api/cart — 수량 변경
export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cart_id, quantity } = await request.json();
  if (!cart_id || quantity < 1) return NextResponse.json({ error: "invalid" }, { status: 400 });

  await shopPool.query(
    `UPDATE cart SET quantity = $1 WHERE id = $2 AND user_id = $3`,
    [quantity, cart_id, user.id]
  );
  return NextResponse.json({ ok: true });
}

// DELETE /api/cart — 항목 삭제
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cart_id } = await request.json();
  await shopPool.query(
    `DELETE FROM cart WHERE id = $1 AND user_id = $2`,
    [cart_id, user.id]
  );
  return NextResponse.json({ ok: true });
}
