import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import WithdrawButton from "@/components/WithdrawButton";
import Link from "next/link";

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  customer: { label: "일반 고객", color: "bg-gray-100 text-gray-600" },
  influencer: { label: "인플루언서", color: "bg-orange-100 text-orange-600" },
  vendor: { label: "벤더사", color: "bg-blue-100 text-blue-600" },
};

const ROLE_STATUS_LABEL: Record<string, string> = {
  pending: "심사 중",
  approved: "승인됨",
  rejected: "반려됨",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid:      { label: "결제완료", color: "text-blue-500" },
  preparing: { label: "배송준비", color: "text-yellow-500" },
  shipped:   { label: "배송중",   color: "text-orange-500" },
  delivered: { label: "배송완료", color: "text-green-500" },
  cancelled: { label: "취소됨",   color: "text-gray-400" },
};

async function getOrders(userId: string) {
  try {
    const result = await shopPool.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.status, o.paid_at,
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity
          ) ORDER BY oi.id
        ) AS items
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.paid_at DESC
      LIMIT 20`,
      [userId]
    );
    return result.rows;
  } catch {
    return [];
  }
}

export default async function MyPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload) redirect("/login");

  const result = await pool.query(
    "SELECT id, name, nickname, profile_image, role, role_status FROM shop_users WHERE id = $1",
    [payload.id]
  );
  const user = result.rows[0];
  if (!user) redirect("/login");

  const orders = await getOrders(payload.id);
  const roleInfo = ROLE_LABEL[user.role] ?? ROLE_LABEL.customer;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* 프로필 */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 shrink-0">
            {user.profile_image ? (
              <img src={user.profile_image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">👤</div>
            )}
          </div>
          <div>
            <p className="text-xl font-black text-gray-900 mb-1">
              {user.nickname || user.name || "이름 없음"}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
              {user.role_status && user.role !== "customer" && (
                <span className="text-xs text-gray-400">
                  {ROLE_STATUS_LABEL[user.role_status] ?? user.role_status}
                </span>
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100 mb-10" />

        {/* 구매 내역 */}
        <section className="mb-10">
          <h2 className="text-sm font-black mb-3" style={{ color: "var(--text-primary)" }}>
            구매 내역
          </h2>
          {orders.length === 0 ? (
            <div
              className="rounded-2xl p-5 text-sm"
              style={{ border: "1px solid var(--warm-gray)", color: "var(--text-muted)" }}
            >
              구매 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const statusInfo = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-gray-400" };
                const paidAt = order.paid_at
                  ? new Date(order.paid_at).toLocaleDateString("ko-KR")
                  : "";
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl p-4"
                    style={{ border: "1px solid var(--warm-gray)" }}
                  >
                    {/* 주문 헤더 */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          {order.order_number}
                        </span>
                        <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                          {paidAt}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* 아이템 목록 */}
                    <div className="space-y-1.5 mb-3">
                      {order.items.map((item: { product_id: string; product_name: string; unit_price: number; quantity: number }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <Link
                            href={`/products/${item.product_id}`}
                            className="text-sm font-medium hover:underline truncate max-w-[220px]"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.product_name}
                          </Link>
                          <span className="text-xs shrink-0 ml-3" style={{ color: "var(--text-muted)" }}>
                            {item.unit_price.toLocaleString()}원 × {item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 총액 + 리뷰 */}
                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: "1px solid var(--warm-gray)" }}
                    >
                      <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        총 {Number(order.total_amount).toLocaleString()}원
                      </span>
                      {order.status === "delivered" && (
                        <Link
                          href={`/products/${order.items[0]?.product_id}#review`}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                        >
                          리뷰 쓰기
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* OS 구독 */}
        <section className="mb-10">
          <h2 className="text-sm font-black text-gray-900 mb-3">OS 구독</h2>
          <div className="border border-gray-100 p-5">
            <p className="text-sm text-gray-400">구독을 하지 않은 상태입니다.</p>
            <button className="mt-4 text-sm font-bold text-white bg-black px-5 py-2.5 hover:bg-gray-800 transition-colors">
              구독하기
            </button>
          </div>
        </section>

        {/* 로그아웃 */}
        <div className="text-center">
          <a href="/api/auth/logout" className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
            로그아웃
          </a>
          <span className="text-gray-200 mx-3">|</span>
          <WithdrawButton />
        </div>
      </div>
    </main>
  );
}
