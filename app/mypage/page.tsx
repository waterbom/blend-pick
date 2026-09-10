import {accountFilters,accountHref,type AccountQuery} from "@/lib/account-filters";
import { currentSite } from "@/lib/site-server";
import { getOrders } from "@/lib/customer-orders";
import CustomerOrders from "@/components/CustomerOrders";
import SanjiMyPage from "@/components/sanji/SanjiMyPage";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import Header from "@/components/Header";
import WithdrawButton from "@/components/WithdrawButton";

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

async function getHotelReservations(userId: string, page=1) {
  try {
    const result = await shopPool.query(
      `SELECT o.id, o.order_number, o.total_amount, o.status, o.paid_at, o.addr_memo,
              to_char(o.stay_check_in, 'YYYY-MM-DD')  AS check_in,
              to_char(o.stay_check_out, 'YYYY-MM-DD') AS check_out,
              (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
         FROM orders o
        WHERE o.user_id = $1 AND o.site = 'blendpick' AND o.order_type = 'hotel'
        ORDER BY o.paid_at DESC NULLS LAST, o.id DESC
        LIMIT 21 OFFSET ${(page-1)*20}`,
      [userId]
    );
    return result.rows;
  } catch {
    return null;
  }
}

export const metadata={title:"마이페이지",robots:{index:false,follow:false}};
export default async function MyPage({searchParams=Promise.resolve({})}:{searchParams?:Promise<AccountQuery>}) {
  const query=await searchParams;
  if ((await currentSite()).key === "sanjipick") return <SanjiMyPage searchParams={Promise.resolve(query)} />;
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_token")?.value;
  if (adminToken && await verifyAdminToken(adminToken)) redirect("/admin");
  const token = cookieStore.get("shop_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload) redirect("/login");

  const result = await pool.query(
    "SELECT id, name, nickname, profile_image, role, role_status FROM shop_users WHERE id = $1 AND is_active = true",
    [payload.id]
  );
  const user = result.rows[0];
  if (!user) redirect("/login");

  // 인플루언서는 마이페이지 대신 인플루언서 탭으로
  // 구매 내역은 역할과 무관하게 유지한다.

  const orders = await getOrders(payload.id, "blendpick",query);
  const hotelPage=accountFilters({page:query.hotel_page}).page;
  const hotelReservations = await getHotelReservations(payload.id,hotelPage);
  const roleInfo = ROLE_LABEL[user.role] ?? ROLE_LABEL.customer;

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 md:gap-12 items-start">
        {/* 좌측 레일 — 프로필 + 메뉴 */}
        <aside className="md:sticky md:top-6">
        <div className="ds-card flex items-center gap-4 p-5">
          <div className="w-16 h-16 overflow-hidden shrink-0" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
            {user.profile_image ? (
              <img src={user.profile_image} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: "#B4B0A2" }}>👤</div>
            )}
          </div>
          <div>
            <div className="ds-caption mb-1">MY PAGE</div>
            <p className="ds-serif text-lg font-semibold m-0" style={{ color: "var(--text-primary)" }}>
              {user.nickname || user.name || "이름 없음"}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5" style={{ letterSpacing: "0.08em", color: "var(--accent-hover)", background: "var(--accent-soft)" }}>
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
        <nav className="ds-card mt-4 flex flex-col">
          <a href="#orders" className="px-5 py-3 text-[13px] font-bold" style={{ color: "var(--accent-hover)", borderLeft: "2px solid var(--accent-hover)", background: "var(--surface-soft)" }}>주문 내역</a>
          <a href="#hotel" className="px-5 py-3 text-[13px]" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--line-soft)" }}>호텔 예약 내역</a>
          {user.role==="influencer"&&<a href="/influencer" className="px-5 py-3 text-sm">인플루언서 활동</a>}
          <a href="/api/auth/logout" className="px-5 py-3 text-[13px]" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--line-soft)" }}>로그아웃</a>
        </nav>
        </aside>

        <div className="min-w-0">
        <CustomerOrders orders={orders} query={query} />
        {/* 호텔 예약 내역 */}
        <section id="hotel" className="mb-10">
          <div className="ds-section-title mb-4"><span>호텔 예약 내역</span></div>
          {hotelReservations===null ? <div role="alert">호텔 예약을 불러오지 못했습니다. <a href="?">다시 조회</a></div> : hotelReservations.length === 0 ? (
            <div className="ds-card p-5 text-sm" style={{ color: "var(--text-muted)" }}>
              호텔 예약 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {hotelReservations.slice(0,20).map((rv) => {
                const st = HOTEL_STATUS_LABEL[rv.status] ?? { label: rv.status, color: "text-gray-400" };
                const paidAt = rv.paid_at ? new Date(rv.paid_at).toLocaleDateString("ko-KR") : "";
                return (
                  <div key={rv.id} className="ds-card">
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="ds-mono text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{paidAt}</span>
                        <span className="ds-mono text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{rv.order_number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 shrink-0" style={{ letterSpacing: "0.08em", color: "var(--accent-hover)", background: "var(--accent-soft)" }}>호텔 예약</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{rv.product_name}</p>
                      <p className="text-xs tnum mb-3" style={{ color: "var(--text-muted)" }}>
                        {fmtStayDate(rv.check_in)} 입실 ~ {fmtStayDate(rv.check_out)} 퇴실
                      </p>
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                        <span className="ds-mono text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
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
          <nav aria-label="호텔 예약 페이지" className="flex gap-4 mt-4">{hotelPage>1&&<a href={accountHref(query,{hotel_page:String(hotelPage-1)},"hotel")}>이전 예약</a>}{hotelReservations&&hotelReservations.length>20&&<a href={accountHref(query,{hotel_page:String(hotelPage+1)},"hotel")}>다음 예약</a>}</nav>
        </section>

        

        {/* 로그아웃 */}
        <div className="text-center">

          <WithdrawButton />
        </div>
        </div>
      </div>
    </main>
  );
}
