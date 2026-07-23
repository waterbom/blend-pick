import { NextRequest, NextResponse } from "next/server";
import shopPool from "@/lib/db-shop";
import pool from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { shopUnitPrice } from "@/lib/shop-price";
import { findClosedSaleProduct } from "@/lib/sale-window";
import { randomBytes } from "crypto";

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `BP-${date}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, checkoutData } = await req.json();

  const secretKey = process.env.TOSS_SECRET_KEY!;

  // 0. 판매 시간창 검사 — 오픈 전/종료 상품이 담겨 있으면 승인 자체를 막는다 (승인 전이라 카드 청구 없음)
  const cartItems: Array<{ product_id: string | null }> = Array.isArray(checkoutData?.items) ? checkoutData.items : [];
  const closed = await findClosedSaleProduct(cartItems.map((i) => i.product_id));
  if (closed) {
    return NextResponse.json(
      { ok: false, error: "아직 판매 기간이 아니거나 종료된 상품이 있습니다. 오픈 시간에 다시 시도해주세요." },
      { status: 400 }
    );
  }

  // 1. 토스페이먼츠 결제 승인
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const tossData = await tossRes.json();
  if (!tossRes.ok) {
    return NextResponse.json(
      { ok: false, error: tossData.message || "결제 승인 실패" },
      { status: 400 }
    );
  }

  // 2. 로그인 유저 확인 (비로그인도 허용)
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  let userId: string | null = null;
  if (token) {
    const payload = await verifyToken(token);
    userId = payload?.id ?? null;
  }

  // 3. DB 저장: orders 1건 + order_items N줄 + cart 비우기
  const orderNumber = generateOrderNumber();
  const items: Array<{
    id: string; // cart item id (장바구니 비우기용)
    product_id: string | null; // 추가옵션은 null
    name: string;
    price: number;
    extra_price: number | null;
    quantity: number;
    option_id: string | null;
    is_addon?: boolean;
  }> = checkoutData.items;

  // 인플루언서 링크 유입 검증 — 요율은 대표(첫) 상품의 influencer_rate 스냅샷
  let influencer: { id: string; name: string } | null = null;
  let commissionRate: number | null = null;
  if (checkoutData.influencerId) {
    try {
      const r = await pool.query("SELECT id, name FROM influencers WHERE id = $1", [checkoutData.influencerId]);
      influencer = r.rows[0] ?? null;
      const mainProductId = items.find((i) => i.product_id)?.product_id;
      if (influencer && mainProductId) {
        const pr = await shopPool.query("SELECT influencer_rate FROM products_shop WHERE id = $1", [mainProductId]);
        commissionRate = pr.rows[0]?.influencer_rate != null ? Number(pr.rows[0].influencer_rate) : null;
      }
    } catch (e) {
      console.error("[cart-confirm] 인플루언서 조회 실패:", e);
    }
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // orders 테이블에 주문 1건 INSERT
    const { rows } = await client.query(
      `INSERT INTO orders (
        order_number, user_id, buyer_name, buyer_phone, buyer_email,
        addr_zipcode, addr_address, addr_detail, addr_memo,
        total_amount, shipping_fee,
        status, payment_key, payment_method, paid_at, order_type,
        influencer_id, influencer_name, commission_rate
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'paid',$12,$13,NOW(),'shop',
        $14,$15,$16)
      RETURNING id`,
      [
        orderNumber,
        userId,
        checkoutData.customerName,
        checkoutData.customerPhone,
        checkoutData.customerEmail || null,
        checkoutData.shippingZipcode,
        checkoutData.shippingAddress,
        checkoutData.shippingAddress2 || null,
        checkoutData.shippingMemo || null,
        checkoutData.totalAmount + checkoutData.shippingCost,
        checkoutData.shippingCost,
        paymentKey,
        tossData.method,
        influencer?.id ?? null,
        influencer?.name ?? null,
        influencer ? commissionRate : null,
      ]
    );

    const newOrderId = rows[0].id;

    // order_items: 장바구니 아이템 수만큼 INSERT (결제시점 공급가 스냅샷 포함)
    for (const item of items) {
      const unitPrice = shopUnitPrice(item.price, item.extra_price, item.option_id != null);
      let supplyPrice: number | null = null;
      if (item.product_id) {
        const spRes = await client.query(
          `SELECT COALESCE(po.supply_price, ps.supply_price) AS supply_price
           FROM products_shop ps
           LEFT JOIN product_options po ON po.id = $2 AND po.product_id = ps.id
           WHERE ps.id = $1`,
          [item.product_id, item.option_id ?? null]
        );
        supplyPrice = spRes.rows[0]?.supply_price ?? null;
      }
      await client.query(
        `INSERT INTO order_items (order_id, product_id, option_id, product_name, unit_price, quantity, supply_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newOrderId, item.product_id, item.option_id ?? null, item.name, unitPrice, item.quantity, supplyPrice]
      );

      // 재고 차감 — 옵션 상품은 옵션 재고, 상품 재고는 항상 함께 차감 (추가옵션은 product_id 없음 → 제외)
      if (item.product_id && !item.is_addon) {
        await client.query(
          `UPDATE products_shop SET stock = GREATEST(stock - $1, 0) WHERE id = $2`,
          [item.quantity, item.product_id]
        );
        if (item.option_id) {
          await client.query(
            `UPDATE product_options SET stock = GREATEST(stock - $1, 0) WHERE id = $2`,
            [item.quantity, item.option_id]
          );
        }
      }
    }

    // 결제 완료된 아이템들을 cart 테이블에서 삭제
    const cartIds = items.map((i) => i.id);
    if (cartIds.length > 0) {
      await client.query(
        `DELETE FROM cart WHERE id = ANY($1::uuid[])`,
        [cartIds]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      orderNumber,
      itemCount: items.length,
      totalAmount: checkoutData.totalAmount + checkoutData.shippingCost,
      paymentMethod: tossData.method,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[cart-confirm] DB 저장 실패:", e);
    return NextResponse.json({ ok: false, error: "주문 저장 실패" }, { status: 500 });
  } finally {
    client.release();
  }
}
