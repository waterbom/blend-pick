import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import CopyLinkButton from "@/components/CopyLinkButton";
import FirstBuyersClient from "@/components/FirstBuyersClient";
import {
  BUSINESS_TYPE_LABEL,
  COUNTABLE_ORDER_STATUSES,
  calcCommission,
  calcPayout,
  HOTEL_COMMISSION_RATE,
  HOTEL_PAYOUT_CAMPAIGN_ID,
  HOTEL_LABEL,
  type BusinessType,
} from "@/lib/settlement";

/**
 * 인플루언서 탭 — 발급 계정으로 로그인한 인플루언서 전용
 * 프로필 + 진행 공구 현황(수수료율/판매/예상 지급액) + 전용 링크 복사
 */

const WON = (n: number) => `${n.toLocaleString()}원`;
const d = (s: string) => String(s).slice(0, 10);

export default async function InfluencerPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token);
  if (!payload) redirect("/login");

  // role은 DB에서 재확인 (토큰 위조/역할 변경 대비)
  const userRes = await pool.query("SELECT id, role FROM shop_users WHERE id = $1", [payload.id]);
  const user = userRes.rows[0];
  if (!user) redirect("/login");
  if (user.role !== "influencer") redirect("/mypage");

  const infRes = await pool.query(
    `SELECT id, name, platform, profile_image, category, followers_count,
            business_type, bank_name, bank_account, bank_holder,
            to_char(hotel_sale_start AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS hotel_open,
            to_char(hotel_sale_deadline AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS hotel_close
     FROM influencers WHERE user_id = $1`,
    [user.id]
  );
  const inf = infRes.rows[0];

  if (!inf) {
    return (
      <main className="min-h-screen" style={{ background: "var(--background)" }}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          인플루언서 정보가 아직 연결되지 않았어요. 관리자에게 문의해주세요.
        </div>
      </main>
    );
  }

  const businessType = (inf.business_type ?? "freelancer") as BusinessType;

  // 본인 공구 목록 (OS DB)
  const campaignsRes = await pool.query(
    `SELECT c.id, to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
            c.commission_rate, c.is_archived,
            c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
              AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
              AND c.is_archived = false AS active,
            p.name AS product_name, p.product_image,
            COALESCE(NULLIF(sp.price, 0), NULLIF(c.unit_price, 0),
                     NULLIF(p.groupbuy_price, 0), p.consumer_price, 0) AS unit_price
     FROM campaigns c
     JOIN products p ON p.id = c.product_id
     LEFT JOIN sales_pages sp ON sp.campaign_id = c.id
     WHERE c.influencer_id = $1
     ORDER BY c.is_archived ASC, c.end_date DESC`,
    [inf.id]
  );
  const campaigns = campaignsRes.rows;

  // 상품공구(Shop 상품) — 수수료율이 설정된 판매 중 상품 중 내 소속(또는 공용)만 전용 링크 발급
  // 판매중 상품 + (품절·판매종료여도) 내 귀속 판매가 있는 상품 —
  // 공구 마감 후 품절 처리해도 인플루언서의 실적·금액 표시가 사라지지 않게
  const shopProductsRes = await shopPool.query(
    `SELECT p.id, p.name, p.influencer_rate, p.status
       FROM products_shop p
      WHERE p.influencer_rate IS NOT NULL
        AND (p.influencer_id IS NULL OR p.influencer_id = $1)
        AND (p.status = 'active'
             OR EXISTS (SELECT 1 FROM orders o
                          JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = p.id
                         WHERE o.influencer_id = $1 AND o.campaign_id IS NULL))
      ORDER BY (p.status <> 'active'), p.created_at DESC`,
    [inf.id]
  );
  const shopProducts = shopProductsRes.rows as { id: string; name: string; influencer_rate: number; status: string }[];

  // 상품공구 내 귀속 매출 (상품별)
  // 주의: order_items를 그냥 JOIN하면 옵션 여러 줄 주문에서 주문 금액이 줄 수만큼
  // 중복 합산된다 — (주문, 상품) 1행으로 접은 뒤 집계해야 한다
  const shopSalesRes = await shopPool.query(
    `SELECT op.product_id, COUNT(*) AS orders,
            COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross
       FROM orders o
       JOIN (SELECT DISTINCT order_id, product_id FROM order_items WHERE product_id IS NOT NULL) op
         ON op.order_id = o.id
      WHERE o.order_type = 'shop' AND o.influencer_id = $1 AND o.campaign_id IS NULL
        AND o.status = ANY($2)
      GROUP BY op.product_id`,
    [inf.id, [...COUNTABLE_ORDER_STATUSES]]
  );
  const shopSalesMap = new Map(shopSalesRes.rows.map((r) => [r.product_id, r]));

  // 호텔공구 매출 (공통 요율 — 링크만 공유하면 귀속)
  const hotelSalesRes = await shopPool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
     FROM orders
     WHERE order_type = 'hotel' AND influencer_id = $1 AND status = ANY($2)`,
    [inf.id, [...COUNTABLE_ORDER_STATUSES]]
  );
  const hotelPayoutRes = await shopPool.query(
    `SELECT status, payout_amount FROM influencer_payouts
     WHERE campaign_id = $1 AND influencer_id = $2`,
    [HOTEL_PAYOUT_CAMPAIGN_ID, inf.id]
  );
  const hotelGross = Number(hotelSalesRes.rows[0]?.gross ?? 0);
  const hotelCommission = calcCommission(hotelGross, HOTEL_COMMISSION_RATE);
  const hotelBreakdown = calcPayout(hotelCommission, businessType);
  const hotel = {
    orders: Number(hotelSalesRes.rows[0]?.orders ?? 0),
    gross: hotelGross,
    commission: hotelCommission,
    breakdown: hotelBreakdown,
    payoutStatus: hotelPayoutRes.rows[0]?.status ?? null,
    settlementAmount: hotelPayoutRes.rows[0]
      ? Number(hotelPayoutRes.rows[0].payout_amount)
      : hotelBreakdown.payout,
  };

  // 공구별 판매 집계 + 정산 상태 (Shop DB)
  const ids = campaigns.map((c) => c.id);
  let salesMap = new Map<string, { orders: number; qty: number; gross: number }>();
  let payoutMap = new Map<string, { status: string; payout_amount: number }>();
  if (ids.length > 0) {
    const [sales, payouts] = await Promise.all([
      shopPool.query(
        `SELECT o.campaign_id,
                COUNT(*) AS orders,
                COALESCE(SUM((SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id)), 0) AS qty,
                COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross
         FROM orders o
         WHERE o.campaign_id = ANY($1) AND o.status = ANY($2)
         GROUP BY o.campaign_id`,
        [ids, [...COUNTABLE_ORDER_STATUSES]]
      ),
      shopPool.query(
        `SELECT campaign_id, status, payout_amount
         FROM influencer_payouts WHERE campaign_id = ANY($1) AND influencer_id = $2`,
        [ids, inf.id]
      ),
    ]);
    salesMap = new Map(
      sales.rows.map((r) => [r.campaign_id, { orders: Number(r.orders), qty: Number(r.qty), gross: Number(r.gross) }])
    );
    payoutMap = new Map(payouts.rows.map((r) => [r.campaign_id, { status: r.status, payout_amount: Number(r.payout_amount) }]));
  }

  const rows = campaigns.map((c) => {
    const sales = salesMap.get(c.id) ?? { orders: 0, qty: 0, gross: 0 };
    const rate = c.commission_rate != null ? Number(c.commission_rate) : null;
    const commission = rate != null ? calcCommission(sales.gross, rate) : null;
    const breakdown = commission != null ? calcPayout(commission, businessType) : null;
    const payout = payoutMap.get(c.id);
    return {
      ...c,
      sales,
      rate,
      commission,
      breakdown,
      payoutStatus: payout?.status ?? null,
      // 정산 확정 전엔 예상치, 확정되면 확정 금액
      settlementAmount: payout?.payout_amount ?? breakdown?.payout ?? null,
    };
  });

  const card = "bg-white rounded-2xl p-5";
  const cardStyle = { border: "1px solid var(--line)" };

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            인플루언서
          </h1>
          <a
            href="/api/auth/logout"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            로그아웃
          </a>
        </div>

        {/* 프로필 */}
        <section className={card} style={cardStyle}>
          <div className="flex items-center gap-4">
            {inf.profile_image ? (
              <img src={inf.profile_image} alt={inf.name} className="w-14 h-14 rounded-full object-cover bg-gray-100" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🤝</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>@{inf.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[inf.platform, inf.category].filter(Boolean).join(" · ") || "—"}
                {inf.followers_count != null && ` · 팔로워 ${Number(inf.followers_count).toLocaleString()}`}
              </p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {BUSINESS_TYPE_LABEL[businessType]}
            </span>
          </div>
          {inf.bank_name && (
            <p className="text-xs mt-3 pt-3" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--line)" }}>
              정산계좌: {inf.bank_name} {inf.bank_account} ({inf.bank_holder})
            </p>
          )}
        </section>

        {/* 공구 등록은 관리자 중앙관리 — 인플루언서는 발급된 전용 링크 공유 + 실적 확인만 */}

        {/* 호텔공구 — 링크만 공유하면 귀속 (전 인플루언서 공통 요율) */}
        <section className={card} style={cardStyle}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>🏨 {HOTEL_LABEL}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {inf.hotel_open && inf.hotel_close
                  ? `내 공구 일정: ${inf.hotel_open} ~ ${inf.hotel_close} · 링크로 들어온 예약이 내 실적으로 집계돼요`
                  : "링크를 공유하면 그 링크로 들어온 예약이 내 실적으로 집계돼요"}
              </p>
            </div>
            {inf.hotel_open && inf.hotel_close ? (
              <CopyLinkButton path={`/hotel/reserve?inf=${inf.id}`} />
            ) : (
              <span className="text-xs shrink-0 px-3 py-2 rounded-lg" style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}>
                공구 일정 설정 후 링크가 발급돼요
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs tnum pt-3" style={{ borderTop: "1px solid var(--line)" }}>
            <div>
              <p style={{ color: "var(--text-muted)" }}>수수료율</p>
              <p className="font-bold" style={{ color: "var(--accent)" }}>{HOTEL_COMMISSION_RATE}%</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>예약건수</p>
              <p className="font-bold" style={{ color: "var(--text-primary)" }}>{hotel.orders}건</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>총매출</p>
              <p className="font-bold" style={{ color: "var(--text-primary)" }}>{WON(hotel.gross)}</p>
            </div>
            <div>
              <p style={{ color: "var(--text-muted)" }}>{hotel.payoutStatus ? "정산금액" : "예상 정산금액"}</p>
              <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                {WON(hotel.settlementAmount)}
                {hotel.payoutStatus === "paid" && <span className="ml-1 text-[10px] font-bold" style={{ color: "#16a34a" }}>지급완료</span>}
              </p>
            </div>
          </div>
        </section>

        {/* 상품공구 — 전용 링크로 판매하면 귀속 (상품별 요율) */}
        {shopProducts.length > 0 && (
          <section className={card} style={cardStyle}>
            <h2 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>🛍 상품 공구 전용 링크</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              링크를 공유하면 그 링크로 들어온 구매가 내 실적으로 집계돼요
            </p>
            <div className="space-y-2">
              {shopProducts.map((p) => {
                const sale = shopSalesMap.get(p.id);
                return (
                  <div key={p.id} className="text-sm rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {p.name}
                          {p.status !== "active" && (
                            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 align-middle"
                              style={{ background: "#F3F4F6", color: "#6B7280", borderRadius: "4px" }}>
                              판매 종료
                            </span>
                          )}
                        </p>
                        <p className="text-xs mt-0.5 tnum" style={{ color: "var(--text-muted)" }}>
                          수수료 {Number(p.influencer_rate)}%
                          {sale && ` · 내 판매 ${sale.orders}건 / ${WON(Number(sale.gross))}`}
                        </p>
                      </div>
                      {p.status === "active" && <CopyLinkButton path={`/products/${p.id}?inf=${inf.id}`} />}
                    </div>
                    {/* 선착순 구매자 — 내 링크 유효 결제만, 번호 중복 제거, 승인시간 순 */}
                    <FirstBuyersClient productId={p.id} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 공구 현황 */}
        <section className={card} style={cardStyle}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            내 공구 현황 <span className="font-medium" style={{ color: "var(--text-muted)" }}>({rows.length})</span>
          </h2>

          {rows.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              진행 중인 공구가 없어요
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((c) => (
                <div key={c.id} className="rounded-xl p-4" style={{ background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {c.product_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {d(c.start_date)} ~ {d(c.end_date)}
                        {c.active ? (
                          <span className="ml-1.5 font-bold" style={{ color: "var(--accent)" }}>진행중</span>
                        ) : (
                          <span className="ml-1.5">종료</span>
                        )}
                      </p>
                    </div>
                    {c.active && <CopyLinkButton campaignId={c.id} />}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-2 text-xs tnum">
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>제품 단가</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {Number(c.unit_price) > 0 ? WON(Number(c.unit_price)) : "—"}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>수수료율</p>
                      <p className="font-bold" style={{ color: "var(--accent)" }}>
                        {c.rate != null ? `${c.rate}%` : "협의중"}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>주문건수</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{c.sales.orders}건</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>판매수량</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{c.sales.qty}개</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>총매출</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{WON(c.sales.gross)}</p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text-muted)" }}>수수료</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {c.commission != null ? WON(c.commission) : "—"}
                      </p>
                    </div>
                  </div>

                  {c.breakdown && (
                    <div className="mt-3 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--text-muted)" }}>
                        {BUSINESS_TYPE_LABEL[businessType]}
                        {businessType !== "general" && ` · 공급가액 ${WON(c.breakdown.supplyValue)} · 부가세 ${WON(c.breakdown.vat)}`}
                        {businessType === "freelancer" && ` · 원천징수 ${WON(c.breakdown.withholding)}`}
                        {businessType === "general" && " · 세금계산서 발행 후 전액 지급"}
                      </span>
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {c.payoutStatus ? "정산금액" : "예상 정산금액"}{" "}
                        <span style={{ color: "var(--accent)" }}>{WON(c.settlementAmount ?? 0)}</span>
                        <span
                          className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={
                            c.payoutStatus === "paid"
                              ? { background: "#dcfce7", color: "#16a34a" }
                              : { background: "var(--surface-soft)", color: "var(--text-muted)", border: "1px solid var(--line)" }
                          }
                        >
                          {c.payoutStatus === "paid" ? "지급완료" : c.payoutStatus === "pending" ? "정산 확정" : "정산 대기"}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] mt-4" style={{ color: "var(--text-muted)" }}>
            · 링크 복사하기로 받은 전용 링크를 통해 들어온 구매만 내 공구 매출로 집계됩니다.
            <br />· 예상 금액은 현재까지의 판매 기준이며, 최종 정산 시 확정됩니다.
          </p>
        </section>
      </div>
    </main>
  );
}
