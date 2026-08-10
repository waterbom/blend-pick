import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import shopPool from "@/lib/db-shop";
import { verifiedPhoneOf, normPhone } from "@/lib/phone-verify";
import Header from "@/components/Header";
import ReturnRequestForm from "@/components/ReturnRequestForm";

// 비회원 교환·반품 신청 폼 — 주문 조회(휴대폰 인증) 후 진입.
// phone_verified 쿠키(30분)의 번호와 주문의 결제 휴대폰이 일치해야 열린다.
export default async function GuestReturnNewPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) redirect("/orders/lookup");

  const cookieStore = await cookies();
  const phone = await verifiedPhoneOf(cookieStore.get("phone_verified")?.value);
  if (!phone) redirect("/orders/lookup");

  const { rows } = await shopPool.query(
    `SELECT o.id, o.order_number, o.status, o.addr_address, o.addr_detail, o.buyer_phone,
            json_agg(json_build_object(
              'item_id', oi.id,
              'product_name', oi.product_name,
              'option_label', oi.option_label,
              'unit_price', oi.unit_price,
              'quantity', oi.quantity
            ) ORDER BY oi.id) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = $1 AND o.order_type IN ('shop', 'campaign')
      GROUP BY o.id`,
    [orderId]
  );
  const order = rows[0];
  if (!order || normPhone(order.buyer_phone || "") !== phone) redirect("/orders/lookup");
  if (!["shipped", "delivered"].includes(order.status)) redirect("/orders/lookup");

  // 진행 중 신청이 있으면 폼 대신 조회 화면으로 (중복 차단)
  const dup = await shopPool.query(
    `SELECT 1 FROM order_returns WHERE order_id = $1 AND status IN ('requested', 'collecting')`,
    [orderId]
  );
  if (dup.rows[0]) redirect("/orders/lookup");

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="ds-caption mb-1">EXCHANGE / RETURN</div>
        <h1 className="ds-serif text-2xl font-semibold mb-1" style={{ color: "#1C2418" }}>
          교환·반품 신청
        </h1>
        <p className="ds-mono text-xs mb-8" style={{ color: "#8B927F" }}>{order.order_number}</p>
        <ReturnRequestForm
          orderId={order.id}
          items={order.items}
          defaultAddress={order.addr_address || ""}
          defaultAddressDetail={order.addr_detail || ""}
          doneHref="/orders/lookup"
        />
      </div>
    </main>
  );
}
