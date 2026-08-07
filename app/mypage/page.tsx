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
import { RETURN_KIND_LABEL } from "@/lib/returns";

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
        o.recipient_name, o.buyer_name, o.addr_address, o.addr_detail,
        to_char(o.shipped_at   AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS shipped_kst,
        to_char(o.delivered_at AT TIME ZONE 'Asia/Seoul', 'MM/DD') AS delivered_kst,
        (SELECT json_build_object('kind', r.kind, 'status', r.status,
                'created_kst', to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD'))
           FROM order_returns r WHERE r.order_id = o.id
          ORDER BY r.created_at DESC LIMIT 1) AS latest_return,
        (SELECT e.note FROM order_return_events e
           JOIN order_returns r2 ON r2.id = e.return_id
          WHERE r2.order_id = o.id AND e.status = 'rejected'
          ORDER BY e.created_at DESC LIMIT 1) AS return_reject_note,
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'reviewed', EXISTS (SELECT 1 FROM reviews rv WHERE rv.order_id = o.id AND rv.product_id = oi.product_id)
          ) ORDER BY (oi.product_id IS NULL), oi.id
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 md:gap-12 items-start">
        {/* 좌측 레일 — 프로필 + 메뉴 */}
        <aside className="md:sticky md:top-6">
        <div className="ds-card flex items-center gap-4 p-5">
          <div className="w-16 h-16 overflow-hidden shrink-0" style={{ background: "#F6F4EE", border: "1px solid #E4E1D6" }}>
            {user.profile_image ? (
              <img src={user.profile_image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: "#B4B0A2" }}>👤</div>
            )}
          </div>
          <div>
            <div className="ds-caption mb-1">MY PAGE</div>
            <p className="ds-serif text-lg font-semibold m-0" style={{ color: "#1C2418" }}>
              {user.nickname || user.name || "이름 없음"}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5" style={{ letterSpacing: "0.08em", color: "#244B1F", background: "#EAF0E6" }}>
                {roleInfo.label}
              </span>
              {user.role_status && user.role !== "customer" && (
                <span className="text-xs" style={{ color: "#8B927F" }}>
                  {ROLE_STATUS_LABEL[user.role_status] ?? user.role_status}
                </span>
              )}
            </div>
          </div>
        </div>
        <nav className="ds-card mt-4 flex flex-col">
          <a href="#orders" className="px-5 py-3 text-[13px] font-bold" style={{ color: "#244B1F", borderLeft: "2px solid #244B1F", background: "#F6F4EE" }}>주문 내역</a>
          <a href="#hotel" className="px-5 py-3 text-[13px]" style={{ color: "#4A5442", borderTop: "1px solid #F0EDE4" }}>호텔 예약 내역</a>
          <a href="#subscribe" className="px-5 py-3 text-[13px]" style={{ color: "#4A5442", borderTop: "1px solid #F0EDE4" }}>OS 구독</a>
          <a href="/api/auth/logout" className="px-5 py-3 text-[13px]" style={{ color: "#8B927F", borderTop: "1px solid #F0EDE4" }}>로그아웃</a>
        </nav>
        </aside>

        <div className="min-w-0">
        {/* 호텔 예약 내역 */}
        <section id="hotel" className="mb-10">
          <div className="ds-section-title mb-4"><span>호텔 예약 내역</span></div>
          {hotelReservations.length === 0 ? (
            <div className="ds-card p-5 text-sm" style={{ color: "#8B927F" }}>
              호텔 예약 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {hotelReservations.map((rv) => {
                const st = HOTEL_STATUS_LABEL[rv.status] ?? { label: rv.status, color: "text-gray-400" };
                const paidAt = rv.paid_at ? new Date(rv.paid_at).toLocaleDateString("ko-KR") : "";
                return (
                  <div key={rv.id} className="ds-card">
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #E4E1D6", background: "#FAFAF6" }}>
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="ds-mono text-xs font-semibold" style={{ color: "#5C6553" }}>{paidAt}</span>
                        <span className="ds-mono text-[11px] truncate" style={{ color: "#8B927F" }}>{rv.order_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 shrink-0" style={{ letterSpacing: "0.08em", color: "#244B1F", background: "#EAF0E6" }}>호텔 예약</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-sm font-semibold mb-1" style={{ color: "#1C2418" }}>{rv.product_name}</p>
                      <p className="text-xs tnum mb-3" style={{ color: "#8B927F" }}>
                        {fmtStayDate(rv.check_in)} 입실 ~ {fmtStayDate(rv.check_out)} 퇴실
                      </p>
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #E4E1D6" }}>
                        <span className="ds-mono text-sm font-semibold" style={{ color: "#1C2418" }}>
                          {Number(rv.total_amount).toLocaleString()}원
                        </span>
                        {rv.status === "paid" && (
                          <a href="http://pf.kakao.com/_VyING/chat" target="_blank" rel="noopener noreferrer"
                            className="text-xs font-bold px-4 py-2"
                            style={{ background: "#FAE100", color: "#3C1E1E" }}>
                            변경·취소 문의
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 구매 내역 */}
        <section id="orders" className="mb-10">
          <div className="ds-section-title mb-4"><span>주문 내역</span></div>
          {orders.length === 0 ? (
            <div className="ds-card p-5 text-sm" style={{ color: "#8B927F" }}>
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
                  <div key={order.id} className="ds-card">
                    {/* 주문 헤더 스트립 */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #E4E1D6", background: "#FAFAF6" }}>
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="ds-mono text-xs font-semibold" style={{ color: "#5C6553" }}>{paidAt}</span>
                        <span className="ds-mono text-[11px] truncate" style={{ color: "#8B927F" }}>{order.order_number}</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* 아이템 목록 */}
                    <div className="space-y-1.5 px-5 pt-4 mb-3">
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

                    {/* 배송지 */}
                    {order.addr_address && (
                      <p className="px-5 pb-2 m-0 text-xs" style={{ color: "#8B927F" }}>
                        배송지 · {order.recipient_name ?? order.buyer_name} · {order.addr_address}{order.addr_detail ? ` ${order.addr_detail}` : ""}
                      </p>
                    )}

                    {/* 상태 타임라인 — 결제 완료 → 상품 준비 → 배송 중 → 배송 완료 (발송·완료일 병기) */}
                    {["paid", "confirmed", "preparing", "shipped", "delivered"].includes(order.status) && (
                      <div className="flex flex-wrap items-center gap-y-1 px-5 pb-3">
                        {(() => {
                          const stepIdx = order.status === "delivered" ? 3 : order.status === "shipped" ? 2 : order.status === "preparing" ? 1 : 0;
                          return ["결제 완료", "상품 준비", "배송 중", "배송 완료"].map((label, i) => (
                            <span key={label} className="flex items-center">
                              <span className="text-[10.5px] font-bold" style={{ color: i <= stepIdx ? "#2D5A27" : "#B4B0A2" }}>{label}</span>
                              {i < 3 && <span className="inline-block w-6 sm:w-8 h-px mx-1.5" style={{ background: i < stepIdx ? "#2D5A27" : "#E4E1D6" }} />}
                            </span>
                          ));
                        })()}
                        {(order.shipped_kst || order.delivered_kst) && (
                          <span className="ds-mono text-[10.5px] ml-3" style={{ color: "#8B927F" }}>
                            {order.shipped_kst && `발송 ${order.shipped_kst}`}
                            {order.shipped_kst && order.delivered_kst && " · "}
                            {order.delivered_kst && `완료 ${order.delivered_kst}`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 교환·반품 진행 타임라인 — 신청 접수 → 수거·처리 중 → 완료 */}
                    {order.latest_return && order.latest_return.status !== "rejected" && (
                      <div className="flex flex-wrap items-center gap-y-1 px-5 pb-3">
                        {(() => {
                          const r = order.latest_return;
                          const kindLabel = RETURN_KIND_LABEL[r.kind] ?? r.kind;
                          const stepIdx = r.status === "done" ? 2 : r.status === "collecting" ? 1 : 0;
                          return (
                            <>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 mr-2 shrink-0"
                                style={{ color: "#6D28D9", background: "#F3EFFB" }}>{kindLabel}</span>
                              {["신청 접수", "수거·처리 중", `${kindLabel} 완료`].map((label, i) => (
                                <span key={label} className="flex items-center">
                                  <span className="text-[10.5px] font-bold" style={{ color: i <= stepIdx ? "#6D28D9" : "#B4B0A2" }}>{label}</span>
                                  {i < 2 && <span className="inline-block w-6 sm:w-8 h-px mx-1.5" style={{ background: i < stepIdx ? "#6D28D9" : "#E4E1D6" }} />}
                                </span>
                              ))}
                              <span className="ds-mono text-[10.5px] ml-3" style={{ color: "#8B927F" }}>신청 {r.created_kst}</span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {order.latest_return?.status === "rejected" && (
                      <p className="px-5 pb-3 text-[11px] m-0" style={{ color: "#B08968" }}>
                        교환·반품 신청이 거절되었어요.
                        {order.return_reject_note ? ` 사유: ${order.return_reject_note}` : " 자세한 내용은 카카오 채널로 문의해주세요."}
                      </p>
                    )}

                    {/* 총액 + 버튼 */}
                    <div
                      className="flex items-center justify-between px-5 py-3.5"
                      style={{ borderTop: "1px solid #E4E1D6" }}
                    >
                      <span className="ds-mono text-sm font-semibold" style={{ color: "#1C2418" }}>
                        {Number(order.total_amount).toLocaleString()}원
                      </span>
                      <div className="flex items-center gap-2">
                        {(order.status === "shipped" || order.status === "delivered") &&
                          order.tracking_company && order.tracking_number && (
                          <a
                            href={trackingUrl(order.tracking_company, order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3.5 py-2 transition-colors"
                            style={{ border: "1px solid #E4E1D6", color: "#4A5442" }}
                          >
                            {carrierName(order.tracking_company)} 조회
                          </a>
                        )}
                        {["paid", "confirmed", "preparing", "shipped"].includes(order.status) && (
                          <CancelOrderButton orderId={order.id} status={order.status} />
                        )}
                        {["shipped", "delivered"].includes(order.status) &&
                          !(order.latest_return && ["requested", "collecting"].includes(order.latest_return.status)) && (
                          <Link
                            href={`/mypage/returns/new?order=${order.id}`}
                            className="text-xs px-3.5 py-2 transition-colors"
                            style={{ border: "1px solid #E4E1D6", color: "#4A5442" }}
                          >
                            교환·반품
                          </Link>
                        )}
                        {order.status === "delivered" && (
                          order.items[0]?.reviewed ? (
                            <span className="text-xs font-semibold px-3.5 py-2" style={{ border: "1px solid #E4E1D6", color: "#8F948A" }}>
                              리뷰 작성완료 ✓
                            </span>
                          ) : (
                            <Link
                              href={`/products/${order.items[0]?.product_id}#review`}
                              className="text-xs font-semibold px-3.5 py-2"
                              style={{ border: "1px solid #244B1F", color: "#244B1F" }}
                            >
                              리뷰 쓰기
                            </Link>
                          )
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
        <section id="subscribe" className="mb-10">
          <div className="ds-section-title mb-4"><span>OS 구독</span></div>
          <div className="ds-card p-5">
            <p className="text-sm" style={{ color: "#8B927F" }}>구독을 하지 않은 상태입니다.</p>
            <button className="ds-btn ds-btn-primary mt-4 px-8" style={{ height: "44px", fontSize: "13px" }}>
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
      </div>
    </main>
  );
}
