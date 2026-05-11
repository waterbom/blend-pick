import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 상품 단건 조회
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await shopPool.query(
    "SELECT * FROM products_shop WHERE id = $1", [id]
  );
  if (!result.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}

// 상품 수정
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    name, brand, description, price, original_price,
    stock, category, status, shipping_type, shipping_cost, main_image,
  } = body;

  await shopPool.query(`
    UPDATE products_shop SET
      name = $1, brand = $2, description = $3, price = $4,
      original_price = $5, stock = $6, category = $7, status = $8,
      shipping_type = $9, shipping_cost = $10, main_image = $11,
      updated_at = NOW()
    WHERE id = $12
  `, [
    name, brand || null, description || null, price,
    original_price || null, stock ?? 0, category || null,
    status, shipping_type, shipping_cost ?? 3000,
    main_image || null, id,
  ]);

  return NextResponse.json({ ok: true });
}

// 상품 삭제
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await shopPool.query("DELETE FROM products_shop WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
