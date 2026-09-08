import shopPool from "@/lib/db-shop";
import { cartShippingFee, type CartFeeItem } from "@/lib/shipping";
import { cleanLinkCode, linkApplies, linkDelta, linkedUnitPrice } from "@/lib/secret-link";

// 결제 금액 서버 재계산 — 토스 승인 전에 화면이 보낸 금액이 DB 가격·배송비 규칙과 맞는지 확인한다.
// 화면(sessionStorage)이나 결제창 요청값을 고쳐도 승인 자체가 막히고, 승인 전이라 카드 청구는 없다.
// 계산 규칙은 상세·장바구니·결제 화면과 같은 함수(shopUnitPrice → linkedUnitPrice, cartShippingFee)를 쓴다.
// 비밀링크(?k=) 결제는 상품의 link_code 와 코드가 맞을 때만 링크가(link_price)로 계산한다 — 코드가 틀리면 전시가 기준.

export type AmountCheck =
  | { ok: true; linkCode: string | null } // linkCode: 실제로 링크가가 적용된 비밀링크 코드 (주문 스냅샷용)
  | { ok: false; error: string; detail: string };

const MISMATCH = "결제 금액이 현재 상품 가격과 달라요. 상품을 다시 담아 결제해주세요.";

interface ProductRow {
  id: string;
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
  price?: number;         // 추가옵션은 여기 고정가
  is_addon?: boolean;
  name?: string;
  link_code?: string | null; // 비밀링크로 담긴 줄이면 그 코드 (상품별)
}

// 장바구니·상세 '구매하기'(여러 줄) 결제: totalAmount = 상품+추가옵션 합, amount = totalAmount + shippingCost
export async function verifyCartAmount(p: {
  items: CartAmountItem[];
  totalAmount: unknown;
  shippingCost: unknown;
  amount: unknown;
}): Promise<AmountCheck> {
  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) return { ok: false, error: MISMATCH, detail: "items empty" };
  if (items.some((it) => !isQty(it.quantity))) return { ok: false, error: MISMATCH, detail: "bad quantity" };

  const mains = items.filter((it) => it.product_id && !it.is_addon);
  const addons = items.filter((it) => !it.product_id || it.is_addon);
  if (!mains.length) return { ok: false, error: MISMATCH, detail: "no main product" };

  const productIds = [...new Set(mains.map((it) => it.product_id as string))];
  const optionIds = [...new Set(mains.map((it) => it.option_id).filter((x): x is string => !!x))];

  const [pr, or, ar] = await Promise.all([
    shopPool.query(
      `SELECT id, price, link_price, link_code, shipping_type, shipping_cost, free_shipping_threshold, per_unit_shipping_cost
         FROM products_shop WHERE id = ANY($1::uuid[])`,
      [productIds]
    ),
    optionIds.length
      ? shopPool.query(`SELECT id, product_id, extra_price FROM product_options WHERE id = ANY($1::uuid[])`, [optionIds])
      : Promise.resolve({ rows: [] as { id: string; product_id: string; extra_price: number | null }[] }),
    addons.length
      ? shopPool.query(`SELECT product_id, name, extra_price FROM product_addons WHERE product_id = ANY($1::uuid[]) AND is_active = true`, [productIds])
      : Promise.resolve({ rows: [] as { product_id: string; name: string; extra_price: number }[] }),
  ]);
  const products = new Map((pr.rows as ProductRow[]).map((r) => [r.id, r]));
  const options = new Map((or.rows as { id: string; product_id: string; extra_price: number | null }[]).map((r) => [r.id, r]));
  const addonRows = ar.rows as { product_id: string; name: string; extra_price: number }[];

  let expectedItems = 0;
  let appliedLink: string | null = null;
  const feeItems: CartFeeItem[] = [];
  for (const it of mains) {
    const prod = products.get(it.product_id as string);
    if (!prod) return { ok: false, error: MISMATCH, detail: `product missing ${it.product_id}` };
    let extra: number | null = null;
    if (it.option_id) {
      const opt = options.get(it.option_id);
      if (!opt || opt.product_id !== prod.id) return { ok: false, error: MISMATCH, detail: `option missing ${it.option_id}` };
      extra = opt.extra_price == null ? null : n(opt.extra_price);
    }
    // 비밀링크 코드가 이 상품 것일 때만 링크가 차액 적용
    const code = cleanLinkCode(it.link_code);
    const delta = linkDelta({ price: n(prod.price), link_price: prod.link_price, link_code: prod.link_code }, code);
    if (linkApplies({ price: n(prod.price), link_price: prod.link_price, link_code: prod.link_code }, code)) appliedLink = code;
    const unit = linkedUnitPrice(n(prod.price), extra, !!it.option_id, delta);
    expectedItems += unit * n(it.quantity);
    feeItems.push({ ...prod, product_id: prod.id, quantity: n(it.quantity), unit_price: unit });
  }
  for (const it of addons) {
    const base = addonBaseName(String(it.name || ""));
    const match = addonRows.find((a) => productIds.includes(a.product_id) && a.name === base);
    if (!match) return { ok: false, error: MISMATCH, detail: `addon missing "${base}"` };
    if (n(match.extra_price) !== n(it.price)) return { ok: false, error: MISMATCH, detail: `addon price ${base} ${it.price}≠${match.extra_price}` };
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
  return { ok: true, linkCode: appliedLink };
}

// 단품 바로 결제: totalAmount = 단가×수량 + 배송비, amount = totalAmount
export async function verifySingleAmount(p: {
  productId: unknown;
  optionId?: unknown;
  quantity: unknown;
  unitPrice: unknown;
  shippingCost: unknown;
  totalAmount: unknown;
  amount: unknown;
  linkCode?: unknown; // 비밀링크(?k=)로 들어온 결제면 그 코드
}): Promise<AmountCheck> {
  if (typeof p.productId !== "string" || !isQty(p.quantity)) return { ok: false, error: MISMATCH, detail: "bad product/quantity" };
  const optionId = typeof p.optionId === "string" && p.optionId ? p.optionId : null;
  const code = cleanLinkCode(p.linkCode);
  const r = await verifyCartAmount({
    items: [{ product_id: p.productId, option_id: optionId, quantity: n(p.quantity), link_code: code }],
    totalAmount: n(p.totalAmount) - n(p.shippingCost),
    shippingCost: p.shippingCost,
    amount: p.amount,
  });
  if (!r.ok) return r;
  // 단가 표시값도 대조 (주문서 unit_price 스냅샷에 그대로 들어가므로)
  const [pr, opt] = await Promise.all([
    shopPool.query(`SELECT price, link_price, link_code FROM products_shop WHERE id = $1`, [p.productId]),
    optionId ? shopPool.query(`SELECT extra_price FROM product_options WHERE id = $1`, [optionId]) : Promise.resolve({ rows: [] as { extra_price: number | null }[] }),
  ]);
  const prod = pr.rows[0] as { price: number; link_price: number | null; link_code: string | null } | undefined;
  if (!prod) return { ok: false, error: MISMATCH, detail: `product missing ${p.productId}` };
  const extra = optionId ? (opt.rows[0]?.extra_price == null ? null : n(opt.rows[0].extra_price)) : null;
  const unit = linkedUnitPrice(n(prod.price), extra, !!optionId, linkDelta({ ...prod, price: n(prod.price) }, code));
  if (n(p.unitPrice) !== unit) return { ok: false, error: MISMATCH, detail: `unit ${p.unitPrice}≠${unit}` };
  return r;
}
