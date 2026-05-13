import shopPool from "@/lib/db-shop";
import Link from "next/link";
import OrderStatusButton from "@/components/admin/OrderStatusButton";

interface OrderRow {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  total_amount: number;
  shipping_fee: number;
  status: string;
  created_at: string;
}

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

async function getOrderCounts() {
  const result = await shopPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'paid')      AS new_orders,
      COUNT(*) FILTER (WHERE status = 'preparing') AS preparing,
      COUNT(*) FILTER (WHERE status = 'shipped')   AS shipped,
      COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
      COUNT(*)                                     AS total
    FROM orders
  `);
  return result.rows[0];
}

async function getOrders(status?: string) {
  let query = `SELECT id, order_number, buyer_name, buyer_phone, total_amount, shipping_fee, status, created_at FROM orders`;
  const params: string[] = [];

  if (status) {
    query += ` WHERE status = $1`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT 200`;
  const result = await shopPool.query(query, params);
  return result.rows as OrderRow[];
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [counts, orders] = await Promise.all([
    getOrderCounts(),
    getOrders(status),
  ]);

  const dashboardCards = [
    { key: "paid", label: "신규주문", count: Number(counts.new_orders) },
    { key: "preparing", label: "배송준비", count: Number(counts.preparing) },
    { key: "shipped", label: "배송중", count: Number(counts.shipped) },
    { key: "delivered", label: "배송완료", count: Number(counts.delivered) },
  ];

  return (
    <div>
      {/* 대시보드 카드 */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800">판매 관리</span>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex items-center">
          {dashboardCards.map((card, i) => (
            <div key={card.key} className="flex items-center flex-1">
              <Link href={`/admin/orders?status=${card.key}`} className="flex-1 group">
                <div className="text-xs text-gray-400 mb-1">{card.label}</div>
                <div className="text-2xl font-bold text-gray-800 group-hover:text-orange-500 transition-colors">
                  {card.count}<span className="text-sm font-medium text-gray-400 ml-0.5">건</span>
                </div>
              </Link>
              {i < dashboardCards.length - 1 && (
                <div className="mx-4 text-gray-200 text-lg">›</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl border border-gray-100 p-1">
        {[
          { key: "", label: "전체", count: Number(counts.total) },
          ...dashboardCards,
        ].map((tab) => {
          const active = (status || "") === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/admin/orders?status=${tab.key}` : "/admin/orders"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 주문 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">주문번호</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">주문일시</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">구매자</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">금액</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-gray-400">
                  주문이 없습니다
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{o.buyer_name}</div>
                    <div className="text-xs text-gray-400">{o.buyer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {Number(o.total_amount).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                    <OrderStatusButton orderId={o.id} status={o.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
