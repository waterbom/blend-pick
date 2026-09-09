import { saveProductLogistics } from "@/lib/product-logistics";
import { currentAdminSite, adminProductScopeSql } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { linkSettingsError, saveLinkSettings } from "@/lib/admin-secret-link";
import { productInputError } from "@/lib/product-required";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
export async function GET(_: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const scope = adminProductScopeSql((await currentAdminSite()).key, "category", 2);
    const scoped = await shopPool.query(`SELECT id FROM products_shop WHERE id=$1 AND ${scope.sql} AND archived_at IS NULL`, [id, scope.param]);
    if (!scoped.rows.length)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [product, images, options, addons] = await Promise.all([
        shopPool.query("SELECT p.*,to_jsonb(p)->>'expected_ship_date' AS expected_ship_date FROM products_shop p WHERE id = $1", [id]),
        shopPool.query("SELECT url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC", [id]),
        shopPool.query("SELECT id, name, extra_price, stock, sort_order, is_active, supply_price, link_price FROM product_options WHERE product_id = $1 AND removed_at IS NULL ORDER BY sort_order ASC", [id]),
        shopPool.query("SELECT id, name, extra_price, is_active, supply_price FROM product_addons WHERE product_id = $1 ORDER BY sort_order ASC", [id]),
    ]);
    if (!product.rows[0])
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
        ...product.rows[0],
        extra_images: images.rows.map(r => r.url),
        options: options.rows.map(r => ({
            id: r.id, name: r.name, price: r.extra_price, stock: r.stock, active: r.is_active,
            supply_price: r.supply_price, link_price: r.link_price,
        })),
        addons: addons.rows.map(r => ({
            name: r.name, price: r.extra_price, active: r.is_active, supply_price: r.supply_price,
        })),
    });
}
export async function PATCH(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const scope = adminProductScopeSql((await currentAdminSite()).key, "category", 2);
    const scoped = await shopPool.query(`SELECT id FROM products_shop WHERE id=$1 AND ${scope.sql} AND archived_at IS NULL`, [id, scope.param]);
    if (!scoped.rows.length)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    if (body.category && !((await currentAdminSite()).key === "sanjipick" ? scope.param.includes(body.category) : !scope.param.includes(body.category)))
        return NextResponse.json({ error: "현재 사이트의 카테고리를 선택해주세요." }, { status: 400 });
    const linkError = linkSettingsError(body);
    if (linkError)
        return NextResponse.json({ error: linkError }, { status: 400 });
    const { name, brand, description, price, original_price, instant_discount_price, supply_price, influencer_rate, stock, category, status, sale_type, presale_enabled, presale_start_at, presale_end_at, sale_start_at, sale_end_at, tax_type, shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost, shipping_carrier, shipping_attr, island_shipping_cost, installation_cost, release_address, return_address, return_cost_oneway, return_cost_roundtrip, exchange_cost_oneway, exchange_cost_roundtrip, as_notes, manufacturer, origin_country, product_condition, manufacture_date, main_image, extra_images, options, addons, addon_multi, is_visible, link_price, revoke_link, } = body;
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
    // 필수 — 카테고리, 공급가(상품 공급가 또는 판매중 옵션마다) : 손익 집계 누락 방지 (등록 API와 같은 기준)
    if (!category)
        return NextResponse.json({ error: "카테고리를 선택해주세요." }, { status: 400 });
    const supplyMissing = productInputError({ ...body, category }, (await currentAdminSite()).key);
    if (supplyMissing)
        return NextResponse.json({ error: supplyMissing }, { status: 400 });
    // 비밀링크 가격 — 0 이상 정수만, 비우면 해제 (링크 코드는 별도 API에서 발급/해제)
    const linkPrice = link_price == null || link_price === "" ? null : Math.max(0, Math.round(Number(link_price)) || 0);
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(729081)");
        const current = await client.query('SELECT updated_at FROM products_shop WHERE id=$1 FOR UPDATE', [id]);
        if (current.rows[0]?.updated_at && (!body.expected_updated_at || new Date(body.expected_updated_at).getTime() !== new Date(current.rows[0].updated_at).getTime())) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '상품 또는 재고가 변경되었습니다. 새로고침 후 수정해주세요.' }, { status: 409 });
        }
        await saveLinkSettings(client, id, body);
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
        main_image = $36, addon_multi = $37, supply_price = $38, influencer_rate = $39,
        is_visible = COALESCE($41, is_visible), link_price = $42,
        link_code = CASE WHEN $43::boolean THEN NULL ELSE link_code END, -- 비전시 링크 사용을 끄면 코드 해제
        updated_at = NOW()
      WHERE id = $40
    `, [
            name, brand || null, description || null,
            price, original_price || null, instant_discount_price || null,
            effectiveStock, category || null,
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
            addon_multi !== false,
            supply_price != null && supply_price !== "" ? supply_price : null, // 0원도 값으로 저장 (|| 쓰면 null 돼서 손익에서 빠짐)
            influencer_rate ?? null,
            id,
            typeof is_visible === "boolean" ? is_visible : null,
            linkPrice,
            revoke_link === true,
        ]);
        await client.query("DELETE FROM product_images WHERE product_id = $1", [id]);
        if (Array.isArray(extra_images)) {
            for (let i = 0; i < extra_images.length; i++) {
                if (extra_images[i]) {
                    await client.query(`INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)`, [id, extra_images[i], i]);
                }
            }
        }
        const incoming = (Array.isArray(options) ? options : []).filter(o => o?.name);
        const existing = await client.query('SELECT id,value FROM product_options WHERE product_id=$1 AND removed_at IS NULL FOR UPDATE', [id]);
        const kept: string[] = [];
        for (const [index, opt] of incoming.entries()) {
            const old = opt.id ? existing.rows.find(o => o.id === opt.id) : existing.rows.find(o => o.value === opt.name);
            if (opt.id && !old)
                throw new Error('다른 상품의 옵션입니다.');
            if (old) {
                kept.push(old.id);
                await client.query(`UPDATE product_options SET name=$2,value=$2,extra_price=$3,stock=$4,sort_order=$5,is_active=$6,supply_price=$7,link_price=$8 WHERE id=$1`, [old.id, opt.name, opt.price ?? 0, opt.stock ?? 0, index, opt.active !== false, opt.supply_price ?? null, opt.link_price === '' ? null : opt.link_price ?? null]);
            }
            else {
                const made = await client.query(`INSERT INTO product_options(product_id,name,value,extra_price,stock,sort_order,is_active,supply_price,link_price)
         VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [id, opt.name, opt.price ?? 0, opt.stock ?? 0, index, opt.active !== false, opt.supply_price ?? null, opt.link_price === '' ? null : opt.link_price ?? null]);
                kept.push(made.rows[0].id);
            }
        }
        await client.query('UPDATE product_options SET is_active=false,removed_at=COALESCE(removed_at,NOW()) WHERE product_id=$1 AND NOT(id=ANY($2::uuid[]))', [id, kept]);
        await client.query("DELETE FROM product_addons WHERE product_id = $1", [id]);
        if (Array.isArray(addons)) {
            for (let i = 0; i < addons.length; i++) {
                const ad = addons[i];
                if (ad.name) {
                    await client.query(`INSERT INTO product_addons (product_id, name, extra_price, sort_order, is_active, supply_price)
             VALUES ($1, $2, $3, $4, $5, $6)`, [id, ad.name, ad.price ?? 0, i, ad.active !== false, ad.supply_price ?? null]);
                }
            }
        }
        await saveProductLogistics(client, id, body);
        const saved = await client.query("SELECT updated_at FROM products_shop WHERE id=$1", [id]);
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, updated_at: saved.rows[0].updated_at });
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error(e);
        return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }
    finally {
        client.release();
    }
}
export async function DELETE(_: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const scope = adminProductScopeSql((await currentAdminSite()).key, "category", 2);
    const scoped = await shopPool.query(`SELECT id FROM products_shop WHERE id=$1 AND ${scope.sql} AND archived_at IS NULL`, [id, scope.param]);
    if (!scoped.rows.length)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(729081)");
        // Archive rather than deleting product/option identities used by historic orders.
        const r = await client.query("UPDATE products_shop SET status='draft',is_visible=false,archived_at=NOW(),link_code=NULL,updated_at=NOW() WHERE id=$1", [id]);
        await client.query("UPDATE product_secret_links SET revoked_at=COALESCE(revoked_at,NOW()) WHERE product_id=$1", [id]);
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, deleted: r.rowCount });
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error("[product delete]", e);
        return NextResponse.json({ error: "삭제에 실패했습니다. (연결된 데이터 확인 필요)" }, { status: 500 });
    }
    finally {
        client.release();
    }
}
