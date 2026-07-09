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
    shopPool.query("SELECT id, name, extra_price, stock, sort_order, is_active FROM product_options WHERE product_id = $1 ORDER BY sort_order ASC", [id]),
  ]);

  if (!product.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...product.rows[0],
    extra_images: images.rows.map(r => r.url),
    options: options.rows.map(r => ({
      id: r.id, name: r.name, price: r.extra_price, stock: r.stock, active: r.is_active,
    })),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    name, brand, description, price, original_price, instant_discount_price,
    stock, category, status, sale_type,
    presale_enabled, presale_start_at, presale_end_at,
    sale_start_at, sale_end_at, tax_type,
    shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost,
    shipping_carrier, shipping_attr,
    island_shipping_cost, installation_cost,
    release_address, return_address,
    return_cost_oneway, return_cost_roundtrip,
    exchange_cost_oneway, exchange_cost_roundtrip,
    as_notes,
    manufacturer, origin_country, product_condition, manufacture_date,
    main_image, extra_images, options,
  } = body;

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE products_shop SET
        name = $1, brand = $2, description = $3,
        price = $4, original_price = $5, instant_discount_price = $6,
        stock = $7, category = $8, status = $9, sale_type = $10,
        presale_enabled = $11, presale_start_at = $12, presale_end_at = $13,
        sale_start_at = $14, sale_end_at = $15, tax_type = $16,
        shipping_type = $17, shipping_cost = $18, free_shipping_threshold = $19,
        per_unit_shipping_cost = $20, shipping_carrier = $21, shipping_attr = $22,
        island_shipping_cost = $23, installation_cost = $24,
        release_address = $25, return_address = $26,
        return_cost_oneway = $27, return_cost_roundtrip = $28,
        exchange_cost_oneway = $29, exchange_cost_roundtrip = $30,
        as_notes = $31,
        manufacturer = $32, origin_country = $33,
        product_condition = $34, manufacture_date = $35,
        main_image = $36, updated_at = NOW()
      WHERE id = $37
    `, [
      name, brand || null, description || null,
      price, original_price || null, instant_discount_price || null,
      stock ?? 0, category || null,
      status || "active", sale_type || "always",
      presale_enabled ?? false, presale_start_at || null, presale_end_at || null,
      sale_start_at || null, sale_end_at || null, tax_type || "taxable",
      shipping_type, shipping_cost ?? 3000, free_shipping_threshold || null,
      per_unit_shipping_cost ?? 0,
      shipping_carrier || null, shipping_attr || "standard",
      island_shipping_cost ?? 0, installation_cost ?? 0,
      release_address || null, return_address || null,
      return_cost_oneway ?? 0, return_cost_roundtrip ?? 0,
      exchange_cost_oneway ?? 0, exchange_cost_roundtrip ?? 0,
      as_notes || null,
      manufacturer || null, origin_country || null,
      product_condition || "new", manufacture_date || null,
      main_image || null,
      id,
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
            `INSERT INTO product_options (product_id, name, value, extra_price, stock, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, opt.name, opt.name, opt.price ?? 0, opt.stock ?? 0, i, opt.active !== false]
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
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    // 주문내역은 보존(order_items에 상품명·가격 스냅샷이 남아있음) — 상품 링크만 해제
    await client.query("UPDATE order_items SET product_id = NULL WHERE product_id = $1", [id]);
    // 리뷰 제거 (product_id NO ACTION)
    await client.query("DELETE FROM reviews WHERE product_id = $1", [id]);
    // 이미지·옵션·장바구니는 FK CASCADE로 자동 삭제됨
    const r = await client.query("DELETE FROM products_shop WHERE id = $1", [id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, deleted: r.rowCount });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[product delete]", e);
    return NextResponse.json({ error: "삭제에 실패했습니다. (연결된 데이터 확인 필요)" }, { status: 500 });
  } finally {
    client.release();
  }
}
