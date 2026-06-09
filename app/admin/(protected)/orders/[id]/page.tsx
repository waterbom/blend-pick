import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import Link from "next/link";
import TrackingForm from "@/components/admin/TrackingForm";

const STATUS_LABEL: Record<string, string> = {
  paid: "신규주문",
  preparing: "배송준비",
  shipped: "배송중",
  delivered: "배송완료",
  cancelled: "취소",
};

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-blue-50 text-blue-600",
  preparing: "bg-yellow-50 text-yellow-600",
  shipped: "bg-purple-50 text-purple-600",
  delivered: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-500",
};

async function getOrder(id: string) {
  const result = await shopPool.query(
    `SELECT
      o.id, o.order_number, o.status,
      o.buyer_name, o.buyer_phone, o.buyer_email,
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
          'option_id', oi.option_id,
          'unit_price', oi.unit_price,
          'quantity', oi.quantity
        ) ORDER BY oi.id
      ) AS items
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.id = $1
    GROUP BY o.id`,
    [id]
  );
  return result.rows[0] ?? null;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token || !(await verifyAdminToken(token))) redirect("/admin/login");

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const paymentMethodLabel =
    order.payment_method === "card"
      ? "카드"
      : order.payment_method === "transfer"
      ? "계좌이체"
      : order.payment_method ?? "-";

  return (
    <div className="max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/orders"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ←
        </Link>
        <div>
          <p className="text-xs text-gray-400 font-mono">
            {order.order_number}
          </p>
          <h1 className="text-lg font-bold text-gray-800">주문 상세</h1>
        </div>
        <span
          className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${
            STATUS_STYLE[order.status] ?? "bg-gray-100 text-gray-500"
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* 구매자 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          구매자
        </h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">이름</p>
            <p className="font-medium text-gray-800">{order.buyer_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">연락처</p>
            <p className="font-medium text-gray-800">{order.buyer_phone}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">이메일</p>
            <p className="font-medium text-gray-800">
              {order.buyer_email ?? "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 배송지 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          배송지
        </h2>
        <div className="text-sm space-y-1.5">
          <p className="text-gray-800">
            [{order.addr_zipcode}] {order.addr_address}
          </p>
          {order.addr_detail && (
            <p className="text-gray-600">{order.addr_detail}</p>
          )}
          {order.addr_memo && (
            <p className="text-gray-400 text-xs mt-2">
              배송 메모: {order.addr_memo}
            </p>
          )}
        </div>
      </div>

      {/* 주문 상품 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          주문 상품
        </h2>
        <div className="space-y-3">
          {order.items.map(
            (item: {
              id: string;
              product_id: string;
              product_name: string;
              unit_price: number;
              quantity: number;
            }) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-800 font-medium">
                  {item.product_name}
                </span>
                <span className="text-gray-400 shrink-0 ml-4">
                  {item.unit_price.toLocaleString()}원 × {item.quantity}
                </span>
              </div>
            )
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-400 space-y-1">
            <p>결제수단: {paymentMethodLabel}</p>
            <p>
              결제일:{" "}
              {order.paid_at
                ? new Date(order.paid_at).toLocaleString("ko-KR")
                : "-"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">
              배송비 {Number(order.shipping_fee ?? 0).toLocaleString()}원 포함
            </p>
            <p className="text-base font-bold text-gray-800 mt-0.5">
              총 {Number(order.total_amount).toLocaleString()}원
            </p>
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
