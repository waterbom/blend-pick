import { SITES, type SiteKey } from "@/lib/sites";
import shopPool from "@/lib/db-shop";
import { cartShippingFee, type CartFeeItem } from "@/lib/shipping";
import { cleanLinkCode, linkApplies, secretUnitPrice, INVALID_LINK } from "@/lib/secret-link";
// 결제 금액 서버 재계산 — 토스 승인 전에 화면이 보낸 금액이 DB 가격·배송비 규칙과 맞는지 확인한다.
// 화면(sessionStorage)이나 결제창 요청값을 고쳐도 승인 자체가 막히고, 승인 전이라 카드 청구는 없다.
// 계산 규칙은 상세·장바구니·결제 화면과 같은 함수(secretUnitPrice, cartShippingFee)를 쓴다.
// 비밀링크(?k=) 결제는 상품의 link_code 와 코드가 맞을 때만 링크가(link_price)로 계산한다 — 틀린 코드·기간 외 요청은 차단.
export interface VerifiedItem {
    productId: string | null;
    optionId: string | null;
    productRef: string;
    name: string;
    optionLabel: string | null;
    unitPrice: number;
    quantity: number;
    supplyPrice: number | null;
    commissionRate: number | null;
    taxType: string | null;
}
export type AmountCheck = {
    ok: true;
    snapshots: VerifiedItem[];
    linkCode: string | null;
    linkStartAt: string | Date | null;
    linkEndAt: string | Date | null;
    units: number[];
    names: string[];
    optionLabels: (string | null)[];
} // linkCode: 실제로 링크가가 적용된 비밀링크 코드 (주문 스냅샷용)
 | {
    ok: false;
    error: string;
    detail: string;
};
const MISMATCH = "결제 금액이 현재 상품 가격과 달라요. 상품을 다시 담아 결제해주세요.";
interface ProductRow {
    supply_price: number | null;
    influencer_rate: number | null;
    tax_type: string | null;
    archived_at: string | null;
    sale_start_at: string | null;
    sale_end_at: string | null;
    id: string;
    name: string;
    category: string;
    status: string;
    stock: number;
    is_visible: boolean;
    link_start_at: string | Date | null;
    link_end_at: string | Date | null;
    price: number;
    link_price: number | null;
    link_code: string | null;
    shipping_type: string;
    shipping_cost: number | null;
    free_shipping_threshold: number | null;
    per_unit_shipping_cost: number | null;
}
const n = (v: unknown) => (typeof v === "number" ? v : Number(v));
const isQty = (v: unknown) => Number.isInteger(n(v)) && n(v) > 0;
// 추가옵션 표시명 "[추가] 손잡이 — 라벤더 440ml" → "손잡이"
function addonBaseName(name: string): string {
    return name.replace(/^\[추가\]\s*/, "").split(" — ")[0].trim();
}
export interface CartAmountItem {
    product_id: string | null;
    option_id?: string | null;
    quantity: number;
    price?: number; // 추가옵션은 여기 고정가
    is_addon?: boolean;
    name?: string;
    link_code?: string | null; // 비밀링크로 담긴 줄이면 그 코드 (상품별)
}
// 장바구니·상세 '구매하기'(여러 줄) 결제: totalAmount = 상품+추가옵션 합, amount = totalAmount + shippingCost
export async function verifyCartAmount(p: {
    site?: SiteKey;
    items: CartAmountItem[];
    totalAmount: unknown;
    shippingCost: unknown;
    amount: unknown;
}, db: Pick<typeof shopPool, "query"> = shopPool): Promise<AmountCheck> {
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length)
        return { ok: false, error: MISMATCH, detail: "items empty" };
    if (items.some((it) => !isQty(it.quantity)))
        return { ok: false, error: MISMATCH, detail: "bad quantity" };
    const mains = items.filter((it) => it.product_id && !it.is_addon);
    const addons = items.filter((it) => !it.product_id || it.is_addon);
    if (!mains.length)
        return { ok: false, error: MISMATCH, detail: "no main product" };
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (mains.some(it => typeof it.product_id !== "string" || !uuid.test(it.product_id)))
        return { ok: false, error: "재고가 마감되었습니다. 상품을 다시 확인해주세요.", detail: "unregistered product" };
    const productIds = [...new Set(mains.map((it) => it.product_id as string))];
    const [pr, or, ar] = await Promise.all([
        db.query(`SELECT id, name, category, status, stock, supply_price, influencer_rate, tax_type, archived_at, sale_start_at, sale_end_at, is_visible, link_start_at, link_end_at, price, link_price, link_code, shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost
         FROM products_shop WHERE id = ANY($1::uuid[])`, [productIds]),
        productIds.length
            ? db.query(`SELECT id, product_id, value, extra_price, link_price, stock, is_active, supply_price FROM product_options WHERE product_id = ANY($1::uuid[]) AND removed_at IS NULL`, [productIds])
            : Promise.resolve({ rows: [] as {
                    id: string;
                    product_id: string;
                    value: string;
                    extra_price: number | null;
                    link_price: number | null;
                    stock: number;
                    is_active: boolean;
                    supply_price: number | null;
                }[] }),
        addons.length
            ? db.query(`SELECT product_id, name, extra_price, supply_price FROM product_addons WHERE product_id = ANY($1::uuid[]) AND is_active = true`, [productIds])
            : Promise.resolve({ rows: [] as {
                    product_id: string;
                    name: string;
                    extra_price: number;
                    supply_price: number | null;
                }[] }),
    ]);
    const products = new Map((pr.rows as ProductRow[]).map((r) => [r.id, r]));
    const options = new Map((or.rows as {
        id: string;
        product_id: string;
        value: string;
        extra_price: number | null;
        link_price: number | null;
        stock: number;
        is_active: boolean;
        supply_price: number | null;
    }[]).map((r) => [r.id, r]));
    const addonRows = ar.rows as {
        product_id: string;
        name: string;
        extra_price: number;
        supply_price: number | null;
    }[];
    let expectedItems = 0;
    let appliedLink: string | null = null;
    let linkStartAt: string | Date | null = null, linkEndAt: string | Date | null = null;
    const channels = new Set<string>();
    const prices = new Map<CartAmountItem, number>();
    const names = new Map<CartAmountItem, string>();
    const labels = new Map<CartAmountItem, string | null>();
    const snapshots = new Map<CartAmountItem, VerifiedItem>();
    const feeItems: CartFeeItem[] = [];
    for (const it of mains) {
        const prod = products.get(it.product_id as string);
        if (!prod)
            return { ok: false, error: MISMATCH, detail: `product missing ${it.product_id}` };
        if (prod.archived_at || prod.sale_start_at && Date.now() < new Date(prod.sale_start_at).getTime() || prod.sale_end_at && Date.now() >= new Date(prod.sale_end_at).getTime())
            return { ok: false, error: "판매 기간을 확인해주세요.", detail: "closed sale" };
        if (p.site && (SITES.sanjipick.categories.includes(prod.category) ? "sanjipick" : "blendpick") !== p.site)
            return { ok: false, error: INVALID_LINK, detail: "wrong site" };
        const code = cleanLinkCode(it.link_code);
        const requested = it.link_code !== undefined && it.link_code !== null;
        const linked = linkApplies(prod, code);
        if ((requested && !linked) || (!requested && prod.is_visible === false))
            return { ok: false, error: INVALID_LINK, detail: "invalid link" };
        if (linked && !SITES.sanjipick.categories.includes(prod.category))
            return { ok: false, error: INVALID_LINK, detail: "wrong link site" };
        if (prod.status !== "active" || (prod.stock >= 0 && prod.stock < mains.filter(x => x.product_id === prod.id).reduce((sum, x) => sum + n(x.quantity), 0)))
            return { ok: false, error: "판매 중인 재고를 확인해주세요.", detail: "unavailable product" };
        const opt = it.option_id ? options.get(it.option_id) : null;
        if (it.option_id && (!opt || opt.product_id !== prod.id || !opt.is_active || (opt.stock >= 0 && opt.stock < mains.filter(x => x.option_id === it.option_id).reduce((sum, x) => sum + n(x.quantity), 0))))
            return { ok: false, error: MISMATCH, detail: "unavailable option" };
        if (!it.option_id && [...options.values()].some(o => o.product_id === prod.id && o.is_active))
            return { ok: false, error: MISMATCH, detail: "option required" };
        channels.add(linked ? code! : "display");
        if (channels.size > 1)
            return { ok: false, error: "전시 상품과 비전시 상품, 서로 다른 비전시 링크는 각각 나누어 결제해주세요.", detail: "mixed sales channels" };
        if (linked) {
            appliedLink = code;
            linkStartAt = prod.link_start_at;
            linkEndAt = prod.link_end_at;
        }
        const unit = secretUnitPrice(prod, opt ?? null, linked);
        if (unit === null)
            return { ok: false, error: INVALID_LINK, detail: "link option price missing" };
        prices.set(it, unit);
        names.set(it, prod.name);
        labels.set(it, opt?.value ?? null);
        snapshots.set(it, { productId: prod.id, optionId: opt?.id ?? null, productRef: prod.id, name: prod.name, optionLabel: opt?.value ?? null, unitPrice: unit, quantity: n(it.quantity), supplyPrice: opt?.supply_price ?? prod.supply_price ?? null, commissionRate: prod.influencer_rate == null ? null : Number(prod.influencer_rate), taxType: prod.tax_type ?? null });
        expectedItems += unit * n(it.quantity);
        feeItems.push({ ...prod, product_id: prod.id, quantity: n(it.quantity), unit_price: unit });
    }
    for (const it of addons) {
        const base = addonBaseName(String(it.name || ""));
        const matches = addonRows.filter(a => productIds.includes(a.product_id) && a.name === base);
        const match = matches.length === 1 ? matches[0] : null;
        if (!match)
            return { ok: false, error: MISMATCH, detail: `addon missing "${base}"` };
        if (n(match.extra_price) !== n(it.price))
            return { ok: false, error: MISMATCH, detail: `addon price ${base} ${it.price}≠${match.extra_price}` };
        prices.set(it, n(match.extra_price));
        names.set(it, `[추가] ${match.name}`);
        labels.set(it, null);
        const parent = products.get(match.product_id)!;
        snapshots.set(it, { productId: null, optionId: null, productRef: parent.id, name: `[추가] ${match.name}`, optionLabel: null, unitPrice: n(match.extra_price), quantity: n(it.quantity), supplyPrice: match.supply_price ?? null, commissionRate: parent.influencer_rate == null ? null : Number(parent.influencer_rate), taxType: parent.tax_type ?? null });
        expectedItems += n(match.extra_price) * n(it.quantity);
    }
    const expectedShipping = cartShippingFee(feeItems);
    const expectedTotal = expectedItems + expectedShipping;
    if (n(p.totalAmount) !== expectedItems || n(p.shippingCost) !== expectedShipping || n(p.amount) !== expectedTotal) {
        return {
            ok: false, error: MISMATCH,
            detail: `items ${p.totalAmount}≠${expectedItems} / shipping ${p.shippingCost}≠${expectedShipping} / amount ${p.amount}≠${expectedTotal}`,
        };
    }
    return { ok: true, snapshots: items.map(it => snapshots.get(it)!), linkCode: appliedLink, linkStartAt, linkEndAt, units: items.map(it => prices.get(it)!), names: items.map(it => names.get(it)!), optionLabels: items.map(it => labels.get(it) ?? null) };
}
// 단품 바로 결제: totalAmount = 단가×수량 + 배송비, amount = totalAmount
export async function verifySingleAmount(p: {
    site?: SiteKey;
    productId: unknown;
    optionId?: unknown;
    quantity: unknown;
    unitPrice: unknown;
    shippingCost: unknown;
    totalAmount: unknown;
    amount: unknown;
    linkCode?: unknown; // 비밀링크(?k=)로 들어온 결제면 그 코드
}, db: Pick<typeof shopPool, "query"> = shopPool): Promise<AmountCheck> {
    if (typeof p.productId !== "string" || !isQty(p.quantity))
        return { ok: false, error: MISMATCH, detail: "bad product/quantity" };
    const optionId = typeof p.optionId === "string" && p.optionId ? p.optionId : null;
    const code = p.linkCode as string | null | undefined;
    const r = await verifyCartAmount({
        site: p.site,
        items: [{ product_id: p.productId, option_id: optionId, quantity: n(p.quantity), link_code: code }],
        totalAmount: n(p.totalAmount) - n(p.shippingCost),
        shippingCost: p.shippingCost,
        amount: p.amount,
    }, db);
    if (!r.ok)
        return r;
    const unit = r.units[0];
    if (n(p.unitPrice) !== unit)
        return { ok: false, error: MISMATCH, detail: `unit ${p.unitPrice}≠${unit}` };
    return r;
}
