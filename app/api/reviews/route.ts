import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { verifiedPhoneOf, normPhone } from "@/lib/phone-verify";
import shopPool from "@/lib/db-shop";

// 이름 마스킹: 김민수 → 김*수, 김수 → 김*, 외자/영문도 가운데 가림
function maskName(name: string) {
  const n = (name || "").trim();
  if (n.length <= 1) return n || "구매자";
  if (n.length === 2) return n[0] + "*";
  return n[0] + "*".repeat(n.length - 2) + n[n.length - 1];
}

/**
 * 리뷰 작성 — 배송완료(delivered)된 주문의 구매자만, 주문×상품당 1회.
 * 회원은 주문 이력(user_id), 비회원은 휴대폰 인증(phone_verified 쿠키)의 번호로 본인 주문을 확인.
 */
export async function POST(req: Request) {
  const { product_id, rating, content, images } = await req.json();

  const r = Number(rating);
  if (!product_id || !Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: "별점을 선택해주세요." }, { status: 400 });
  }
  const text = String(content || "").trim();
  if (text.length < 5) {
    return NextResponse.json({ error: "리뷰 내용을 5자 이상 입력해주세요." }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "리뷰는 1,000자까지 쓸 수 있어요." }, { status: 400 });
  }
  const imgs: string[] = Array.isArray(images)
    ? images.filter((u: unknown) => typeof u === "string" && u.startsWith("/uploads/reviews/")).slice(0, 3)
    : [];

  // 본인 확인 — 회원(user_id) 또는 인증된 휴대폰 번호
  const store = await cookies();
  const logged = store.get("shop_token")?.value
    ? await verifyToken(store.get("shop_token")!.value)
    : null;
  const verifiedPhone = await verifiedPhoneOf(store.get("phone_verified")?.value);
  if (!logged?.id && !verifiedPhone) {
    return NextResponse.json({ error: "로그인 또는 휴대폰 인증 후 작성할 수 있어요." }, { status: 401 });
  }

  // 배송완료된 이 상품 주문 중 아직 리뷰를 안 쓴 주문 1건 찾기
  const conds = [`oi.product_id = $1`, `o.status = 'delivered'`];
  const params: unknown[] = [product_id];
  if (logged?.id) {
    params.push(logged.id);
    conds.push(`o.user_id = $${params.length}`);
  } else {
    params.push(normPhone(verifiedPhone!));
    conds.push(`regexp_replace(o.buyer_phone, '[^0-9]', '', 'g') = $${params.length}`);
  }
  const ord = await shopPool.query(
    `SELECT o.id, o.buyer_name
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE ${conds.join(" AND ")}
        AND NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id AND rv.product_id = $1)
      ORDER BY o.created_at LIMIT 1`,
    params
  );
  const order = ord.rows[0];
  if (!order) {
    return NextResponse.json(
      { error: "배송완료된 구매 내역이 있어야 리뷰를 쓸 수 있어요. (이미 작성하셨다면 주문당 1회예요)" },
      { status: 403 }
    );
  }

  await shopPool.query(
    `INSERT INTO reviews (product_id, order_id, buyer_name, rating, content, images)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [product_id, order.id, maskName(order.buyer_name), r, text, imgs]
  );

  return NextResponse.json({ ok: true });
}
