import { saveProductLogistics } from "@/lib/product-logistics";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { linkSettingsError, saveLinkSettings } from "@/lib/admin-secret-link";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import { productInputError } from "@/lib/product-required";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
export async function GET() {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // 접속 도메인 범위(Shop/산지픽)의 상품만
    const c = adminProductScopeSql((await currentAdminSite()).key, "category", 1);
    const result = await shopPool.query(`
    SELECT id, name, brand, price, original_price, stock, category, status, sale_type,
           shipping_type, shipping_cost, main_image, influencer_rate, influencer_id, product_code, created_at
    FROM products_shop
    WHERE ${c.sql} AND archived_at IS NULL
    ORDER BY created_at DESC
  `, [c.param]);
    return NextResponse.json(result.rows);
}
export async function POST(req: Request) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const linkError = linkSettingsError(body);
    if (linkError)
        return NextResponse.json({ error: linkError }, { status: 400 });
    const { name, brand, description, price, original_price, instant_discount_price, supply_price, influencer_rate, stock, category: rawCategory, status, sale_type, presale_enabled, presale_start_at, presale_end_at, sale_start_at, sale_end_at, tax_type, shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost, shipping_carrier, shipping_attr, island_shipping_cost, installation_cost, release_address, return_address, return_cost_oneway, return_cost_roundtrip, exchange_cost_oneway, exchange_cost_roundtrip, as_notes, manufacturer, origin_country, product_condition, manufacture_date, main_image, extra_images, options, addons, addon_multi, is_visible, link_price, } = body;
    // 비밀링크 가격 — 0 이상 정수만 (링크 코드는 등록 후 수정 화면에서 발급)
    const linkPrice = link_price == null || link_price === "" ? null : Math.max(0, Math.round(Number(link_price)) || 0);
    if (!name || price == null) {
        return NextResponse.json({ error: "상품명과 가격은 필수입니다" }, { status: 400 });
    }
    // 산지픽 어드민에서 등록하면 산지픽 카테고리로만 — 다른 카테고리를 골랐거나 비었으면 '산지픽 농산물'
    const site = (await currentAdminSite()).key;
    const sanjiCats = adminProductScopeSql("sanjipick", "category", 1).param;
    const category = site === "sanjipick" && !sanjiCats.includes(rawCategory || "") ? "산지픽 농산물" : rawCategory;
    if (!category)
        return NextResponse.json({ error: "카테고리를 선택해주세요." }, { status: 400 });
    // 공급가 필수 — 비어 있으면 손익 집계에서 그 상품 주문이 통째로 빠지므로 등록 단계에서 막는다
    const supplyMissing = productInputError({ ...body, category }, (await currentAdminSite()).key);
    if (supplyMissing)
        return NextResponse.json({ error: supplyMissing }, { status: 400 });
    // 옵션이 있으면 대표 재고는 판매중 옵션 재고 합계로 자동 반영 ("재고 확인" 버튼 안 눌러도 항상 일치)
    const hasOptions = Array.isArray(options) && options.some((o: {
        name?: string;
    }) => o?.name);
    const effectiveStock = hasOptions
        ? options
            .filter((o: {
            name?: string;
            active?: boolean;
        }) => o?.name && o.active !== false)
            .reduce((s: number, o: {
            stock?: number;
        }) => s < 0 || Number(o.stock) === -1 ? -1 : s + (Number(o.stock) || 0), 0)
        : stock ?? 0;
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(729081)");
        const result = await client.query(`
      INSERT INTO products_shop (
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
        main_image, addon_multi, supply_price, influencer_rate, influencer_id,
        is_visible, link_price
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41,$42
      ) RETURNING id
    `, [
            name, brand || null, description || null,
            price, original_price || null, instant_discount_price || null,
            effectiveStock, category || null,
            status || "active", sale_type || "always",
            presale_enabled ?? false, presale_start_at || null, presale_end_at || null,
            sale_start_at || null, sale_end_at || null, tax_type || "taxable",
            shipping_type || "paid", shipping_cost ?? 3000, free_shipping_threshold || null,
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
            addon_multi !== false,
            supply_price != null && supply_price !== "" ? supply_price : null, // 0원도 값으로 저장 (|| 쓰면 null 돼서 손익에서 빠짐)
            influencer_rate ?? null,
            body.influencer_id || null,
            is_visible !== false, // 전시(true) / 비전시·비밀링크 전용(false)
            linkPrice,
        ]);
        const productId = result.rows[0].id;
        const codeResult = await client.query(`SELECT COALESCE(MAX(CAST(SUBSTRING(product_code FROM 2) AS INTEGER)), 0) + 1 AS next_num
       FROM products_shop WHERE product_code ~ '^P[0-9]+$'`);
        const nextCode = "P" + String(codeResult.rows[0].next_num).padStart(3, "0");
        await client.query(`UPDATE products_shop SET product_code = $1 WHERE id = $2`, [nextCode, productId]);
        if (Array.isArray(extra_images)) {
            for (let i = 0; i < extra_images.length; i++) {
                if (extra_images[i]) {
                    await client.query(`INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)`, [productId, extra_images[i], i]);
                }
            }
        }
        if (Array.isArray(options)) {
            for (let i = 0; i < options.length; i++) {
                const opt = options[i];
                if (opt.name) {
                    await client.query(`INSERT INTO product_options (product_id, name, value, extra_price, stock, sort_order, is_active, supply_price, link_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [productId, opt.name, opt.name, opt.price ?? 0, opt.stock ?? 0, i, opt.active !== false, opt.supply_price ?? null, opt.link_price === "" ? null : opt.link_price ?? null]);
                }
            }
        }
        if (Array.isArray(addons)) {
            for (let i = 0; i < addons.length; i++) {
                const ad = addons[i];
                if (ad.name) {
                    await client.query(`INSERT INTO product_addons (product_id, name, extra_price, sort_order, is_active, supply_price)
             VALUES ($1, $2, $3, $4, $5, $6)`, [productId, ad.name, ad.price ?? 0, i, ad.active !== false, ad.supply_price ?? null]);
                }
            }
        }
        await saveLinkSettings(client, productId, body);
        await saveProductLogistics(client, productId, body);
        const saved = await client.query("SELECT updated_at FROM products_shop WHERE id=$1", [productId]);
        await client.query("COMMIT");
        return NextResponse.json({ id: productId, updated_at: saved.rows[0].updated_at }, { status: 201 });
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        return NextResponse.json({ error: "등록 실패" }, { status: 500 });
    }
    finally {
        client.release();
    }
}
