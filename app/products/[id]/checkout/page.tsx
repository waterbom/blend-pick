import { quoteCartAmount } from "@/lib/order-amount";
import { currentSite } from "@/lib/site-server";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ShopCheckoutClient from "@/components/ShopCheckoutClient";
import { productShippingFee } from "@/lib/shipping";
import { cleanLinkCode, linkApplies, secretUnitPrice } from "@/lib/secret-link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { phoneVerifyOn } from "@/lib/sms";

async function getProduct(id: string) {
  const result = await shopPool.query(
    `SELECT id, name, brand, price, original_price, main_image, shipping_type, shipping_cost,
            free_shipping_threshold, per_unit_shipping_cost, status, stock, is_visible, link_price, link_code, link_start_at, link_end_at
     FROM products_shop WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getOption(optionId: string) {
  const result = await shopPool.query(
    `SELECT id, product_id, name, value, extra_price, link_price, stock, is_active FROM product_options WHERE id = $1 AND removed_at IS NULL`,
    [optionId]
  );
  return result.rows[0] || null;
}

// 인플루언서 전용 링크(?inf=) 검증 — 존재하는 인플루언서만 귀속
async function getInfluencer(inf?: string): Promise<{ id: string } | null> {
  if (!inf) return null;
  try {
    const r = await pool.query("SELECT id FROM influencers WHERE id = $1", [inf]);
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ShopCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ optionId?: string; quantity?: string; inf?: string; k?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { optionId, quantity: qStr, inf, k } = await searchParams;
  const influencer = await getInfluencer(inf);
  const quantity = Math.max(1, parseInt(qStr ?? "1") || 1);

  const [product, option] = await Promise.all([
    getProduct(id),
    optionId ? getOption(optionId) : null,
  ]);

  if (!product) notFound();

  // 비밀링크(?k=) — 상품의 link_code 와 맞을 때만 링크가 적용 (틀린 코드·기간 외 접근은 차단)
  const code = cleanLinkCode(k);
  const linked = linkApplies(product, code);
  if ((k !== undefined && !linked) || (k === undefined && product.is_visible === false)) notFound();
  if (optionId && (!option || option.product_id !== id || !option.is_active || (option.stock >= 0 && option.stock < quantity))) notFound();
  const linkCode = linked ? code : null;
  const unitPrice = secretUnitPrice(product, option, linked);
  if (unitPrice === null) notFound();
  // 배송비 — 어드민 설정(무료/유료/조건부/건별) 전부 반영 (lib/shipping.ts)
  const check = await quoteCartAmount({site:(await currentSite()).key,items:[{product_id:id,option_id:option?.id??null,quantity,link_code:linkCode}],totalAmount:0,shippingCost:0,amount:0});
  const shippingCost=check.ok?check.quote.shippingCost:0;
  const totalAmount=check.ok?check.quote.totalAmount:0;
  if (!check.ok) return (
    <main className="min-h-screen px-6 py-12 text-center">
      <Header />
      <h1 className="text-xl font-bold mt-12">현재 구매할 수 없는 상품입니다</h1>
      <p className="mt-3">{check.error}</p>
      <a href="/" className="inline-block mt-6 underline">상품 다시 확인하기</a>
    </main>
  );
  const clientKey = process.env.TOSS_CLIENT_KEY!;
  // 비회원(로그인 안 함)이면 휴대폰 인증 후 결제
  const shopToken = (await cookies()).get("shop_token")?.value;
  const loggedIn = shopToken ? !!(await verifyToken(shopToken)) : false;
  const phoneVerifyRequired = phoneVerifyOn() && !loggedIn;

  const orderName = option
    ? `${product.name} (${option.value})`
    : product.name;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>주문 / 결제</h1>

        {/* 상품 요약 */}
        <div className="bg-white rounded-2xl p-5 mb-4 flex gap-4 items-center" style={{ border: "1px solid var(--line)" }}>
          {product.main_image && (
            <img src={product.main_image} alt={product.name} className="w-16 h-16 object-contain rounded-xl" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{product.brand}</p>
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{product.name}</p>
            {option && (
              <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>{option.name}: {option.value}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              수량 {quantity}개{linked ? " · 전용 링크 가격 적용" : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{(unitPrice * quantity).toLocaleString()}원</p>
            {shippingCost > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>배송비 {shippingCost.toLocaleString()}원</p>
            )}
          </div>
        </div>

        <ShopCheckoutClient
          influencerId={influencer?.id ?? null}
          linkCode={linkCode}
          productId={product.id}
          productName={product.name}
          optionId={option?.id ?? null}
          optionLabel={option ? `${option.name}: ${option.value}` : null}
          unitPrice={unitPrice}
          quantity={quantity}
          shippingCost={shippingCost}
          totalAmount={totalAmount}
          orderName={orderName}
          clientKey={clientKey}
          phoneVerifyRequired={phoneVerifyRequired}
        />
      </div>
    </main>
  );
}
