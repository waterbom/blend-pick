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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [product, images, options] = await Promise.all([
    shopPool.query("SELECT * FROM products_shop WHERE id = $1", [id]),
    shopPool.query("SELECT url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC", [id]),
    shopPool.query("SELECT id, name, extra_price, stock, sort_order FROM product_options WHERE product_id = $1 ORDER BY sort_order ASC", [id]),
  ]);

  if (!product.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...product.rows[0],
    extra_images: images.rows.map((r) => r.url),
    options: options.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: r.extra_price,
      stock: r.stock,
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    name, brand, description, price, original_price,
    stock, category, status, shipping_type, shipping_cost,
    free_shipping_threshold, main_image,
    extra_images, options,
  } = body;

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE products_shop SET
        name = $1, brand = $2, description = $3, price = $4,
        original_price = $5, stock = $6, category = $7, status = $8,
        shipping_type = $9, shipping_cost = $10, free_shipping_threshold = $11,
        main_image = $12, updated_at = NOW()
      WHERE id = $13
    `, [
      name, brand || null, description || null, price,
      original_price || null, stock ?? 0, category || null,
      status, shipping_type, shipping_cost ?? 3000,
      free_shipping_threshold || null,
      main_image || null, id,
    ]);

    await client.query("DELETE FROM product_images WHERE product_id = $1", [id]);
    if (Array.isArray(extra_images)) {
      for (let i = 0; i < extra_images.length; i++) {
        if (extra_images[i]) {
          await client.query(
            `INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)`,
            [id, extra_images[i], i]
          );
        }
      }
    }

    await client.query("DELETE FROM product_options WHERE product_id = $1", [id]);
    if (Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        if (opt.name) {
          await client.query(
            `INSERT INTO product_options (product_id, name, value, extra_price, stock, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, opt.name, opt.name, opt.price ?? 0, opt.stock ?? 0, i]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await shopPool.query("DELETE FROM products_shop WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
