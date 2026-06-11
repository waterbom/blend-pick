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

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, brand, description, price, original_price,
    stock, category, status, shipping_type, shipping_cost,
    free_shipping_threshold, main_image,
    extra_images, options,
  } = body;

  if (!name || price == null) {
    return NextResponse.json({ error: "상품명과 가격은 필수입니다" }, { status: 400 });
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(`
      INSERT INTO products_shop
        (name, brand, description, price, original_price, stock, category,
         status, shipping_type, shipping_cost, free_shipping_threshold, main_image)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `, [
      name, brand || null, description || null,
      price, original_price || null, stock ?? 0,
      category || null, status || "active",
      shipping_type || "paid", shipping_cost ?? 3000,
      free_shipping_threshold || null,
      main_image || null,
    ]);

    const productId = result.rows[0].id;

    // product_code 자동 채번: 기존 최댓값 + 1 (P001, P002, ...)
    const codeResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(product_code FROM 2) AS INTEGER)), 0) + 1 AS next_num
       FROM products_shop WHERE product_code ~ '^P[0-9]+$'`
    );
    const nextCode = "P" + String(codeResult.rows[0].next_num).padStart(3, "0");
    await client.query(
      `UPDATE products_shop SET product_code = $1 WHERE id = $2`,
      [nextCode, productId]
    );

    if (Array.isArray(extra_images)) {
      for (let i = 0; i < extra_images.length; i++) {
        if (extra_images[i]) {
          await client.query(
            `INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)`,
            [productId, extra_images[i], i]
          );
        }
      }
    }

    if (Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.name) {
          await client.query(
            `INSERT INTO product_options (product_id, name, value, extra_price, stock, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [productId, opt.name, opt.name, opt.price ?? 0, opt.stock ?? 0, i]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: productId }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}
