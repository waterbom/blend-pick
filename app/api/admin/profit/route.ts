import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import {
  COUNTABLE_ORDER_STATUSES,
  calcCommission,
  calcSalesVat,
  calcNetProfit,
  type BusinessType,
} from "@/lib/settlement";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/**
 * 손익관리 — 공구(캠페인) 단위 손익 집계, campaign_id NULL = 자사몰 일반판매
 *
 * 순이익 = 총매출 − 매출부가세(10/110) − 공급가 − 배송비 − PG수수료 − 기타비용 − 인플루언서 수수료
 * - PG수수료: 배송완료 건은 settlements 실측값, 미완료 건은 결제수단별 요율 추정치 ("예상" 표시)
 * - 배송비: campaign_costs의 shipping 카테고리 / 기타비용: 나머지 카테고리
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");
  const channel = searchParams.get("channel"); // 'shop' | 'campaign' | null

  const statuses = [...COUNTABLE_ORDER_STATUSES];
  const conds = ["o.status = ANY($1)", "o.order_type IN ('shop', 'campaign')"];
  const params: unknown[] = [statuses];
  if (from) { params.push(from); conds.push(`o.paid_at >= $${params.length}::date`); }
  if (to) { params.push(to); conds.push(`o.paid_at < ($${params.length}::date + INTERVAL '1 day')`); }
  if (channel === "shop" || channel === "campaign") {
    params.push(channel);
    conds.push(`o.order_type = $${params.length}`);
  }
  const where = `WHERE ${conds.join(" AND ")}`;

  // 1) 주문 단위 집계: 매출 + PG수수료 (settlements 1:1 조인이라 안전)
  //    미정산 건 수수료 추정: 계좌이체 1.65%, 그 외 카드 3.63% (settlements 생성 로직과 동일 기준)
  const ordersQ = shopPool.query(
    `SELECT o.campaign_id,
            COUNT(*) AS orders,
            COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross,
            COALESCE(SUM(
              CASE WHEN s.id IS NOT NULL THEN s.fee
                   ELSE ROUND(o.total_amount * CASE WHEN o.payment_method IN ('transfer', '계좌이체') THEN 0.0165 ELSE 0.0363 END)
              END
            ), 0) AS pg_fee,
            BOOL_OR(s.id IS NULL) AS fee_estimated
     FROM orders o
     LEFT JOIN settlements s ON s.order_id = o.id
     ${where}
     GROUP BY o.campaign_id`,
    params
  );

  // 2) 아이템 단위 집계: 공급가 (수량 곱), 공급가 미입력 아이템 수
  const itemsQ = shopPool.query(
    `SELECT o.campaign_id,
            COALESCE(SUM(oi.supply_price * oi.quantity), 0) AS supply_cost,
            COUNT(*) FILTER (WHERE oi.supply_price IS NULL) AS missing_supply,
            COALESCE(SUM(oi.quantity), 0) AS qty
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.campaign_id`,
    params
  );

  // 3) 공구별 비용 (기간 필터와 무관한 공구 단위 비용)
  const costsQ = shopPool.query(
    `SELECT campaign_id,
            COALESCE(SUM(amount) FILTER (WHERE category = 'shipping'), 0) AS shipping_cost,
            COALESCE(SUM(amount) FILTER (WHERE category <> 'shipping'), 0) AS other_costs
     FROM campaign_costs GROUP BY campaign_id`
  );

  const [orders, items, costs] = await Promise.all([ordersQ, itemsQ, costsQ]);
  if (orders.rows.length === 0) return NextResponse.json([]);

  const itemMap = new Map(items.rows.map((r) => [r.campaign_id, r]));
  const costMap = new Map(costs.rows.map((r) => [r.campaign_id, r]));

  // 4) OS: 공구/인플루언서 정보
  const campaignIds = orders.rows.map((r) => r.campaign_id).filter(Boolean);
  let cMap = new Map<string, { product_name: string; influencer_id: string; influencer_name: string; business_type: string | null; commission_rate: number | null; start_date: string; end_date: string }>();
  if (campaignIds.length > 0) {
    const campaigns = await pool.query(
      `SELECT c.id, c.commission_rate, c.influencer_id,
              to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
              p.name AS product_name, i.name AS influencer_name, i.business_type
       FROM campaigns c
       JOIN products p ON p.id = c.product_id
       JOIN influencers i ON i.id = c.influencer_id
       WHERE c.id = ANY($1)`,
      [campaignIds]
    );
    cMap = new Map(campaigns.rows.map((c) => [c.id, c]));
  }

  // 5) 병합 + 순이익 계산
  const rows = orders.rows.map((o) => {
    const c = o.campaign_id ? cMap.get(o.campaign_id) : null;
    const item = itemMap.get(o.campaign_id);
    const cost = o.campaign_id ? costMap.get(o.campaign_id) : null;

    const gross = Number(o.gross);
    const pgFee = Number(o.pg_fee);
    const supplyCost = Number(item?.supply_cost ?? 0);
    const shippingCost = Number(cost?.shipping_cost ?? 0);
    const otherCosts = Number(cost?.other_costs ?? 0);
    const rate = c?.commission_rate != null ? Number(c.commission_rate) : null;
    const commission = o.campaign_id && rate != null ? calcCommission(gross, rate) : 0;
    const salesVat = calcSalesVat(gross);
    const netProfit = calcNetProfit({ gross, supplyCost, shippingCost, pgFee, otherCosts, commission });

    return {
      campaign_id: o.campaign_id,
      label: c ? c.product_name : o.campaign_id ? "(삭제된 공구)" : "자사몰 일반판매",
      influencer_id: c?.influencer_id ?? null,
      influencer_name: c?.influencer_name ?? null,
      business_type: (c?.business_type ?? null) as BusinessType | null,
      period: c ? `${c.start_date} ~ ${c.end_date}` : null,
      channel: o.campaign_id ? "campaign" : "shop",
      orders: Number(o.orders),
      qty: Number(item?.qty ?? 0),
      gross,
      sales_vat: salesVat,
      supply_cost: supplyCost,
      missing_supply: Number(item?.missing_supply ?? 0),
      shipping_cost: shippingCost,
      pg_fee: pgFee,
      fee_estimated: o.fee_estimated,
      other_costs: otherCosts,
      commission,
      rate,
      net_profit: netProfit,
    };
  });

  rows.sort((a, b) => b.gross - a.gross);
  return NextResponse.json(rows);
}
