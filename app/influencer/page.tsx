import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import CopyLinkButton from "@/components/CopyLinkButton";
import {
  BUSINESS_TYPE_LABEL,
  COUNTABLE_ORDER_STATUSES,
  calcCommission,
  calcPayout,
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
            business_type, bank_name, bank_account, bank_holder
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

  // 공구별 판매 집계 + 정산 상태 (Shop DB)
  const ids = campaigns.map((c) => c.id);
  let salesMap = new Map<string, { orders: number; qty: number; gross: number }>();
  let payoutMap = new Map<string, { status: string; payout_amount: number }>();
  if (ids.length > 0) {
    const [sales, payouts] = await Promise.all([
      shopPool.query(
        `SELECT o.campaign_id,
                COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(oi.quantity), 0) AS qty,
                COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
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
