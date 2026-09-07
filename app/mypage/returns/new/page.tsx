import { sanjiLinkBase } from "@/lib/sanji-link";
import { currentSite } from "@/lib/site-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import ReturnRequestForm from "@/components/ReturnRequestForm";

// 교환·반품 신청 폼 — 마이페이지에서 배송중·배송완료 주문만 진입
export default async function ReturnNewPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const site = await currentSite();
  const mypageHref = site.key === "sanjipick" ? `${await sanjiLinkBase()}/mypage` : "/mypage";
  const loginHref = `/login?redirect=${encodeURIComponent(site.key === "sanjipick" ? "/sanji/mypage" : mypageHref)}`;
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) redirect(loginHref);
  const payload = await verifyToken(token);
  if (!payload) redirect(loginHref);

  const { order: orderId } = await searchParams;
  if (!orderId) redirect(mypageHref);

  const { rows } = await shopPool.query(
    `SELECT o.id, o.order_number, o.status, o.addr_address, o.addr_detail,
            json_agg(json_build_object(
              'item_id', oi.id,
              'product_name', oi.product_name,
              'option_label', oi.option_label,
              'unit_price', oi.unit_price,
              'quantity', oi.quantity
            ) ORDER BY oi.id) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = $1 AND o.user_id = $2 AND o.site = $3 AND o.order_type IN ('shop', 'campaign')
      GROUP BY o.id`,
    [orderId, payload.id, site.key]
  );
  const order = rows[0];
  if (!order || !["shipped", "delivered"].includes(order.status)) redirect(mypageHref);

  // 진행 중 신청이 있으면 폼 대신 마이페이지로 (중복 차단)
  const dup = await shopPool.query(
    `SELECT 1 FROM order_returns WHERE order_id = $1 AND status IN ('requested', 'collecting')`,
    [orderId]
  );
  if (dup.rows[0]) redirect(mypageHref);

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
          doneHref={mypageHref}
          orderId={order.id}
          items={order.items}
          defaultAddress={order.addr_address || ""}
          defaultAddressDetail={order.addr_detail || ""}
        />
      </div>
    </main>
  );
}
