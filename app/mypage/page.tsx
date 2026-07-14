import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import WithdrawButton from "@/components/WithdrawButton";
import CancelOrderButton from "@/components/CancelOrderButton";
import Link from "next/link";
import { carrierName, trackingUrl } from "@/lib/carriers";

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
  paid:               { label: "결제완료",   color: "text-blue-500" },
  confirmed:          { label: "주문확인",   color: "text-blue-600" },
  preparing:          { label: "배송준비",   color: "text-yellow-500" },
  shipped:            { label: "배송중",     color: "text-orange-500" },
  delivered:          { label: "배송완료",   color: "text-green-500" },
  cancelled:          { label: "취소됨",     color: "text-gray-400" },
  cancel_requested:   { label: "취소요청중", color: "text-red-400" },
  exchange_requested: { label: "교환신청",   color: "text-purple-500" },
  exchange_completed: { label: "교환완료",   color: "text-purple-400" },
  return_requested:   { label: "반품신청",   color: "text-orange-400" },
  return_completed:   { label: "반품완료",   color: "text-orange-300" },
};

// 택배사 이름/조회 URL — 숫자 코드·레거시 텍스트 코드 모두 lib/carriers에서 해석

async function getOrders(userId: string) {
  try {
    const result = await shopPool.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.status, o.paid_at,
        o.tracking_company, o.tracking_number,
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
      WHERE o.user_id = $1 AND o.order_type <> 'hotel'
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

const HOTEL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid:       { label: "예약확정",   color: "text-blue-600" },
  checked_in: { label: "체크인완료", color: "text-green-600" },
  cancelled:  { label: "취소됨",     color: "text-gray-400" },
  no_show:    { label: "노쇼",       color: "text-red-500" },
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function fmtStayDate(iso: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

async function getHotelReservations(userId: string) {
  try {
    const result = await shopPool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.paid_at, o.addr_memo,
              to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
              to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
              (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
         FROM orders o
        WHERE o.user_id = $1 AND o.order_type = 'hotel'
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

  // 인플루언서는 마이페이지 대신 인플루언서 탭으로
  if (user.role === "influencer") redirect("/influencer");

  const orders = await getOrders(payload.id);
  const hotelReservations = await getHotelReservations(payload.id);
  const roleInfo = ROLE_LABEL[user.role] ?? ROLE_LABEL.customer;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* 프로필 */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-20 h-20 rounded-full overflow-hidden shrink-0" style={{ background: "var(--surface-soft)" }}>
            {user.profile_image ? (
              <img src={user.profile_image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: "var(--text-muted)" }}>👤</div>
            )}
          </div>
          <div>
            <p className="text-xl font-extrabold mb-1.5" style={{ color: "var(--text-primary)" }}>
              {user.nickname || user.name || "이름 없음"}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
              {user.role_status && user.role !== "customer" && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {ROLE_STATUS_LABEL[user.role_status] ?? user.role_status}
                </span>
              )}
            </div>
          </div>
        </div>

        <hr className="mb-10" style={{ borderColor: "var(--line)" }} />

        {/* 호텔 예약 내역 */}
        <section className="mb-10">
          <h2 className="text-base font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>🏨 호텔 예약 내역</h2>
          {hotelReservations.length === 0 ? (
            <div className="rounded-2xl p-5 text-sm" style={{ border: "1px solid var(--line)", color: "var(--text-muted)" }}>
              호텔 예약 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {hotelReservations.map((rv) => {
                const st = HOTEL_STATUS_LABEL[rv.status] ?? { label: rv.status, color: "text-gray-400" };
                const paidAt = rv.paid_at ? new Date(rv.paid_at).toLocaleDateString("ko-KR") : "";
                return (
                  <div key={rv.id} className="bg-white rounded-2xl p-4" style={{ border: "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{rv.order_number}</span>
                        <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{paidAt}</span>
                      </div>
                      <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-sm font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>{rv.product_name}</p>
                    <p className="text-sm tnum mb-3" style={{ color: "var(--text-secondary)" }}>
                      🗓 {fmtStayDate(rv.check_in)} ~ {fmtStayDate(rv.check_out)}
                    </p>
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                      <span className="text-sm font-bold tnum" style={{ color: "var(--text-primary)" }}>
                        총 {Number(rv.total_amount).toLocaleString()}원
                      </span>
                      {rv.status === "paid" && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>변경·취소는 고객센터로 문의</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 구매 내역 */}
        <section className="mb-10">
          <h2 className="text-base font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>
            구매 내역
          </h2>
          {orders.length === 0 ? (
            <div
              className="rounded-2xl p-5 text-sm"
              style={{ border: "1px solid var(--line)", color: "var(--text-muted)" }}
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
                    style={{ border: "1px solid var(--line)" }}
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

                    {/* 총액 + 버튼 */}
                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <span className="text-sm font-bold tnum" style={{ color: "var(--text-primary)" }}>
                        총 {Number(order.total_amount).toLocaleString()}원
                      </span>
                      <div className="flex items-center gap-2">
                        {(order.status === "shipped" || order.status === "delivered") &&
                          order.tracking_company && order.tracking_number && (
                          <a
                            href={trackingUrl(order.tracking_company, order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
                          >
                            {carrierName(order.tracking_company)} 조회
                          </a>
                        )}
                        {(order.status === "paid" || order.status === "confirmed") && (
                          <CancelOrderButton orderId={order.id} />
                        )}
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
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* OS 구독 */}
        <section className="mb-10">
          <h2 className="text-base font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>OS 구독</h2>
          <div className="rounded-2xl p-5" style={{ border: "1px solid var(--line)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>구독을 하지 않은 상태입니다.</p>
            <button
              className="mt-4 text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-all hover:brightness-95"
              style={{ background: "var(--accent)" }}
            >
              구독하기
            </button>
          </div>
        </section>

        {/* 로그아웃 */}
        <div className="text-center">
          <a href="/api/auth/logout" className="text-xs transition-colors hover:underline" style={{ color: "var(--text-muted)" }}>
            로그아웃
          </a>
          <span className="mx-3" style={{ color: "var(--line)" }}>|</span>
          <WithdrawButton />
        </div>
      </div>
    </main>
  );
}
