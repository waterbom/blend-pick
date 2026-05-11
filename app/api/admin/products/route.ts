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

// 상품 목록 조회
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await shopPool.query(`
    SELECT id, name, brand, price, original_price, stock, category, status,
           shipping_type, shipping_cost, main_image, created_at
    FROM products_shop
    ORDER BY created_at DESC
  `);
  return NextResponse.json(result.rows);
}

// 상품 등록
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, brand, description, price, original_price,
    stock, category, status, shipping_type, shipping_cost, main_image,
  } = body;

  if (!name || !price) {
    return NextResponse.json({ error: "상품명과 가격은 필수입니다" }, { status: 400 });
  }

  const result = await shopPool.query(`
    INSERT INTO products_shop
      (name, brand, description, price, original_price, stock, category,
       status, shipping_type, shipping_cost, main_image)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id
  `, [
    name, brand || null, description || null,
    price, original_price || null, stock ?? 0,
    category || null, status || "draft",
    shipping_type || "paid", shipping_cost ?? 3000,
    main_image || null,
  ]);

  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
