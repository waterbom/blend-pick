import { currentSite } from "@/lib/site-server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelShopOrder } from "@/lib/order-cancel";
import { isPhoneVerified } from "@/lib/phone-verify";

// POST /api/orders/[id]/cancel
// paid/confirmed → 즉시 환불. preparing/shipped → 공급사 출고 중지 확인 후 환불.
// 권한: 로그인 회원(주문 소유자) 또는 휴대폰 인증(phone_verified 쿠키)된 비회원(주문 번호의 결제 휴대폰과 일치)
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  const payload = token ? await verifyToken(token) : null;

  const { id } = await params;
  const site = await currentSite();

  const { rows } = await shopPool.query(
    `SELECT id, status, user_id, buyer_phone FROM orders WHERE id = $1 AND site = $2`,
    [id, site.key]
  );

  if (!rows[0]) return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });

  const order = rows[0];

  const isOwner = !!payload && order.user_id === payload.id;
  const isGuestOwner =
    !isOwner &&
    !!order.buyer_phone &&
    (await isPhoneVerified(cookieStore.get("phone_verified")?.value, order.buyer_phone));
  if (!isOwner && !isGuestOwner) {
    return NextResponse.json(
      { error: payload ? "권한이 없습니다" : "휴대폰 인증 후 이용할 수 있어요." },
      { status: payload ? 403 : 401 }
    );
  }

  // shipped(운송장 등록됨)까지는 취소 "요청" 가능 — 실제 출고 여부는 관리자가 확인 후 승인/반려
  const UNCANCELLABLE = ["delivered", "cancelled", "exchange_requested",
    "exchange_completed", "return_requested", "return_completed", "cancel_requested"];

  if (UNCANCELLABLE.includes(order.status)) {
    return NextResponse.json({ error: "이미 배송이 완료되어 취소할 수 없습니다. 교환·반품 신청을 이용해주세요." }, { status: 400 });
  }

  if (["paid", "confirmed", "preparing", "shipped"].includes(order.status)) {
    const r = await cancelShopOrder(id, "고객 주문 취소", {site:site.key,customerRequest:true});
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.httpStatus });
    if (r.requested) return NextResponse.json({ok:true,status:'cancel_requested',message:'취소 요청이 접수되었습니다. 공급사 출고 중지 여부를 확인한 뒤 환불됩니다. 이미 출고된 경우 회수 안내를 드립니다.'});
    return NextResponse.json({
      ok: true,
      status: "cancelled",
      message: r.refunded
        ? "주문이 취소되었습니다. 결제하신 금액은 전액 환불 처리됐어요. (카드사에 따라 3~5일 소요)"
        : "주문이 취소되었습니다.",
    });
  }

  return NextResponse.json({error:'현재 상태에서 취소할 수 없습니다.'},{status:409});
}
