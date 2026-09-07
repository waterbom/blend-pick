import { currentAdminSite } from "@/lib/admin-site";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import Link from "next/link";
import TrackingForm from "@/components/admin/TrackingForm";
import { SITE_BADGE_CLS, siteLabel } from "@/lib/site-label";
import type { SiteKey } from "@/lib/sites";

const STATUS_LABEL: Record<string, string> = {
  paid:               "신규주문",
  confirmed:          "주문확인",
  preparing:          "배송준비",
  shipped:            "배송중",
  delivered:          "배송완료",
  cancelled:          "취소완료",
  cancel_requested:   "취소요청",
  exchange_requested: "교환신청",
  exchange_completed: "교환완료",
  return_requested:   "반품신청",
  return_completed:   "반품완료",
};

const ORDER_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  campaign: { label: "공동구매", cls: "bg-emerald-50 text-emerald-600" },
  shop:     { label: "상품",     cls: "bg-slate-100 text-slate-600" },
};

const STATUS_STYLE: Record<string, string> = {
  paid:               "bg-blue-50 text-blue-600",
  confirmed:          "bg-indigo-50 text-indigo-600",
  preparing:          "bg-yellow-50 text-yellow-600",
  shipped:            "bg-purple-50 text-purple-600",
  delivered:          "bg-green-50 text-green-600",
  cancelled:          "bg-gray-100 text-gray-400",
  cancel_requested:   "bg-red-50 text-red-500",
  exchange_requested: "bg-violet-50 text-violet-600",
  exchange_completed: "bg-violet-50 text-violet-400",
  return_requested:   "bg-[#EAF0E6] text-[#2D5A27]",
  return_completed:   "bg-[#EAF0E6] text-[#7A8B6F]",
};

async function getOrder(id: string) {
  const site = (await currentAdminSite()).key;
  const result = await shopPool.query(
    `SELECT
      o.id, o.order_number, o.status, o.order_type, o.site,
      o.buyer_name, o.buyer_phone, o.buyer_email,
      o.recipient_name, o.recipient_phone,
      o.addr_zipcode, o.addr_address, o.addr_detail, o.addr_memo,
      o.total_amount, o.shipping_fee,
      o.payment_method, o.payment_key,
      o.tracking_company, o.tracking_number,
      o.paid_at, o.created_at,
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'option_label', oi.option_label,
          'unit_price', oi.unit_price,
          'quantity', oi.quantity
        ) ORDER BY oi.id
      ) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = $1 AND o.site = $2
    GROUP BY o.id`,
    [id, site]
  );
  return result.rows[0] ?? null;
}

function formatDateTime(dt: string | null): string {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium break-all">{value ?? "-"}</span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !(await verifyAdminToken(token))) redirect("/login");

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const paymentMethodLabel =
    order.payment_method === "card" ? "카드" :
    order.payment_method === "transfer" ? "계좌이체" :
    order.payment_method ?? "-";

  const itemTotal = order.items.reduce(
    (sum: number, item: { unit_price: number; quantity: number }) =>
      sum + item.unit_price * item.quantity,
    0
  );

  return (
    <div className="max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/orders" className="text-gray-400 hover:text-gray-600 transition-colors">←</Link>
        <div>
          <p className="text-xs text-gray-400 font-mono">{order.order_number}</p>
          <h1 className="text-lg font-bold text-gray-800">주문 상세</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 결제된 사이트 — 블랜드픽/산지픽 (항상 표시) */}
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${SITE_BADGE_CLS[(order.site as SiteKey) || "blendpick"] ?? SITE_BADGE_CLS.blendpick}`}>
            {siteLabel(order.site)}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${(ORDER_TYPE_BADGE[order.order_type] ?? ORDER_TYPE_BADGE.shop).cls}`}>
            {(ORDER_TYPE_BADGE[order.order_type] ?? ORDER_TYPE_BADGE.shop).label}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[order.status] ?? "bg-gray-100 text-gray-500"}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="bg-white rounded-none border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">주문 정보</h2>
        <Row label="주문번호" value={<span className="font-mono">{order.order_number}</span>} />
        <Row label="주문일시" value={formatDateTime(order.created_at)} />
        <Row label="결제일시" value={formatDateTime(order.paid_at)} />
        <Row label="결제수단" value={paymentMethodLabel} />
      </div>

      {/* 주문자 */}
      <div className="bg-white rounded-none border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">주문자</h2>
        <Row label="이름" value={order.buyer_name} />
        <Row label="연락처" value={order.buyer_phone} />
        <Row label="이메일" value={order.buyer_email ?? "-"} />
      </div>

      {/* 수령인 */}
      <div className="bg-white rounded-none border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">수령인</h2>
        <Row label="이름" value={order.recipient_name ?? order.buyer_name} />
        <Row label="연락처" value={order.recipient_phone ?? order.buyer_phone} />
        <Row label="우편번호" value={order.addr_zipcode} />
        <Row label="주소" value={order.addr_address} />
        {order.addr_detail && <Row label="상세주소" value={order.addr_detail} />}
        {order.addr_memo && <Row label="배송 메모" value={order.addr_memo} />}
      </div>

      {/* 주문 상품 */}
      <div className="bg-white rounded-none border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">주문 상품</h2>
        <div className="space-y-0">
          {order.items.map((item: {
            id: string;
            product_name: string;
            option_label: string | null;
            unit_price: number;
            quantity: number;
          }) => (
            <div key={item.id} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                  {item.option_label && (
                    <p className="text-xs text-gray-400 mt-0.5">옵션: {item.option_label}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">
                    {item.unit_price.toLocaleString()}원 × {item.quantity}
                  </p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {(item.unit_price * item.quantity).toLocaleString()}원
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 금액 합계 */}
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>상품 합계</span>
            <span>{itemTotal.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>배송비</span>
            <span>{Number(order.shipping_fee ?? 0).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-800 pt-1.5 border-t border-gray-50">
            <span>최종 결제금액</span>
            <span className="text-base">{Number(order.total_amount).toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* 운송장 입력 */}
      <TrackingForm
        orderId={order.id}
        currentStatus={order.status}
        trackingCompany={order.tracking_company}
        trackingNumber={order.tracking_number}
      />
    </div>
  );
}
