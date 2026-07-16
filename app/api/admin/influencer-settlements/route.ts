import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import {
  COUNTABLE_ORDER_STATUSES,
  calcCommission,
  calcPayout,
  HOTEL_COMMISSION_RATE,
  HOTEL_PAYOUT_CAMPAIGN_ID,
  HOTEL_LABEL,
  type BusinessType,
} from "@/lib/settlement";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

/**
 * 공구별 인플루언서 정산 현황
 * Shop DB 매출 집계 + OS DB 공구/인플루언서 정보 병합 → 지급액 계산
 * (수수료는 공구 단위 집계 후 현재 요율로 계산 — 확정 시 스냅샷으로 동결)
 */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statuses = [...COUNTABLE_ORDER_STATUSES];

  // 1) Shop: 공구별 매출 (캠페인 주문은 주문당 order_item 1개라 qty도 별도 집계)
  //    + 호텔공구: campaign 없이 influencer_id로만 귀속 (공통 요율)
  const [sales, qtys, hotelSales, shopProductSales, payouts] = await Promise.all([
    shopPool.query(
      `SELECT campaign_id, influencer_id,
              COUNT(*) AS orders,
              COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
       FROM orders
       WHERE campaign_id IS NOT NULL AND influencer_id IS NOT NULL AND status = ANY($1)
       GROUP BY campaign_id, influencer_id`,
      [statuses]
    ),
    shopPool.query(
      `SELECT o.campaign_id, COALESCE(SUM(oi.quantity), 0) AS qty
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.campaign_id IS NOT NULL AND o.status = ANY($1)
       GROUP BY o.campaign_id`,
      [statuses]
    ),
    shopPool.query(
      `SELECT influencer_id,
              COUNT(*) AS orders,
              COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
       FROM orders
       WHERE order_type = 'hotel' AND influencer_id IS NOT NULL AND status = ANY($1)
       GROUP BY influencer_id`,
      [statuses]
    ),
    // 상품공구(Shop 상품): 상품 × 인플루언서 단위 귀속 매출 (버킷 id = product_id)
    shopPool.query(
      `SELECT oi.product_id, o.influencer_id,
              COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(oi.quantity), 0) AS qty,
              COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross,
              ps.name AS product_name, ps.influencer_rate
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id AND oi.product_id IS NOT NULL
       JOIN products_shop ps ON ps.id = oi.product_id
       WHERE o.order_type = 'shop' AND o.influencer_id IS NOT NULL
         AND o.campaign_id IS NULL AND o.status = ANY($1)
       GROUP BY oi.product_id, o.influencer_id, ps.name, ps.influencer_rate`,
      [statuses]
    ),
    shopPool.query(`SELECT * FROM influencer_payouts`),
  ]);

  if (sales.rows.length === 0 && hotelSales.rows.length === 0 && shopProductSales.rows.length === 0) {
    return NextResponse.json([]);
  }

  const campaignIds = [...new Set(sales.rows.map((r) => r.campaign_id))];
  const influencerIds = [
    ...new Set([
      ...sales.rows.map((r) => r.influencer_id),
      ...hotelSales.rows.map((r) => r.influencer_id),
      ...shopProductSales.rows.map((r) => r.influencer_id),
    ]),
  ];

  // 2) OS: 공구/인플루언서 정보
  const [campaigns, influencers] = await Promise.all([
    campaignIds.length > 0
      ? pool.query(
          `SELECT c.id, to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
                  to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
                  c.commission_rate, p.name AS product_name
           FROM campaigns c JOIN products p ON p.id = c.product_id
           WHERE c.id = ANY($1)`,
          [campaignIds]
        )
      : Promise.resolve({ rows: [] as never[] }),
    pool.query(
      `SELECT id, name, business_type, bank_name, bank_account, bank_holder,
              id_card_file, biz_cert_file, bankbook_file
       FROM influencers WHERE id = ANY($1)`,
      [influencerIds]
    ),
  ]);

  const cMap = new Map(campaigns.rows.map((c) => [c.id, c]));
  const iMap = new Map(influencers.rows.map((i) => [i.id, i]));
  const qMap = new Map(qtys.rows.map((q) => [q.campaign_id, Number(q.qty)]));
  const pMap = new Map(payouts.rows.map((p) => [`${p.campaign_id}:${p.influencer_id}`, p]));

  // 3) 병합 + 지급액 계산
  const rows = sales.rows.map((s) => {
    const c = cMap.get(s.campaign_id);
    const i = iMap.get(s.influencer_id);
    const payout = pMap.get(`${s.campaign_id}:${s.influencer_id}`) ?? null;

    const gross = Number(s.gross);
    const rate = c?.commission_rate != null ? Number(c.commission_rate) : null;
    const businessType = (i?.business_type ?? null) as BusinessType | null;
    const commission = rate != null ? calcCommission(gross, rate) : null;
    const breakdown =
      commission != null && businessType ? calcPayout(commission, businessType) : null;

    // 사업자유형별 필수 서류 완비 여부
    const docsOk =
      !i || !businessType
        ? false
        : businessType === "freelancer"
        ? !!(i.id_card_file && i.bankbook_file)
        : !!(i.biz_cert_file && i.bankbook_file);

    return {
      campaign_id: s.campaign_id,
      influencer_id: s.influencer_id,
      product_name: c?.product_name ?? "(삭제된 공구)",
      influencer_name: i?.name ?? "(삭제됨)",
      start_date: c?.start_date ?? null,
      end_date: c?.end_date ?? null,
      business_type: businessType,
      bank: i?.bank_name ? `${i.bank_name} ${i.bank_account} (${i.bank_holder})` : null,
      docs_ok: docsOk,
      orders: Number(s.orders),
      qty: qMap.get(s.campaign_id) ?? 0,
      gross,
      rate,
      commission,
      breakdown,
      payout: payout
        ? {
            id: payout.id,
            status: payout.status,
            payout_amount: Number(payout.payout_amount),
            commission: Number(payout.commission),
            supply_value: Number(payout.supply_value),
            vat: Number(payout.vat),
            withholding: Number(payout.withholding),
            paid_at: payout.paid_at,
          }
        : null,
    };
  });

  // 4) 호텔공구 행 — 공통 요율(수기 상수), payout은 센티널 campaign_id로 관리
  const hotelRows = hotelSales.rows.map((s) => {
    const i = iMap.get(s.influencer_id);
    const payout = pMap.get(`${HOTEL_PAYOUT_CAMPAIGN_ID}:${s.influencer_id}`) ?? null;
    const gross = Number(s.gross);
    const businessType = (i?.business_type ?? null) as BusinessType | null;
    const commission = calcCommission(gross, HOTEL_COMMISSION_RATE);
    const breakdown = businessType ? calcPayout(commission, businessType) : null;
    const docsOk =
      !i || !businessType
        ? false
        : businessType === "freelancer"
        ? !!(i.id_card_file && i.bankbook_file)
        : !!(i.biz_cert_file && i.bankbook_file);

    return {
      campaign_id: HOTEL_PAYOUT_CAMPAIGN_ID,
      influencer_id: s.influencer_id,
      product_name: HOTEL_LABEL,
      influencer_name: i?.name ?? "(삭제됨)",
      start_date: null,
      end_date: null,
      business_type: businessType,
      bank: i?.bank_name ? `${i.bank_name} ${i.bank_account} (${i.bank_holder})` : null,
      docs_ok: docsOk,
      orders: Number(s.orders),
      qty: Number(s.orders),
      gross,
      rate: HOTEL_COMMISSION_RATE,
      commission,
      breakdown,
      payout: payout
        ? {
            id: payout.id,
            status: payout.status,
            payout_amount: Number(payout.payout_amount),
            commission: Number(payout.commission),
            supply_value: Number(payout.supply_value),
            vat: Number(payout.vat),
            withholding: Number(payout.withholding),
            paid_at: payout.paid_at,
          }
        : null,
    };
  });

  // 5) 상품공구(Shop 상품) 행 — 상품별 요율(products_shop.influencer_rate), payout 버킷 = product_id
  const shopProductRows = shopProductSales.rows.map((s) => {
    const i = iMap.get(s.influencer_id);
    const payout = pMap.get(`${s.product_id}:${s.influencer_id}`) ?? null;
    const gross = Number(s.gross);
    const businessType = (i?.business_type ?? null) as BusinessType | null;
    const rate = s.influencer_rate != null ? Number(s.influencer_rate) : null;
    const commission = rate != null ? calcCommission(gross, rate) : null;
    const breakdown = businessType && commission != null ? calcPayout(commission, businessType) : null;
    const docsOk =
      !i || !businessType
        ? false
        : businessType === "freelancer"
        ? !!(i.id_card_file && i.bankbook_file)
        : !!(i.biz_cert_file && i.bankbook_file);

    return {
      campaign_id: s.product_id,
      influencer_id: s.influencer_id,
      product_name: `상품공구 · ${s.product_name}`,
      influencer_name: i?.name ?? "(삭제됨)",
      start_date: null,
      end_date: null,
      business_type: businessType,
      bank: i?.bank_name ? `${i.bank_name} ${i.bank_account} (${i.bank_holder})` : null,
      docs_ok: docsOk,
      orders: Number(s.orders),
      qty: Number(s.qty),
      gross,
      rate,
      commission,
      breakdown,
      payout: payout
        ? {
            id: payout.id,
            status: payout.status,
            payout_amount: Number(payout.payout_amount),
            commission: Number(payout.commission),
            supply_value: Number(payout.supply_value),
            vat: Number(payout.vat),
            withholding: Number(payout.withholding),
            paid_at: payout.paid_at,
          }
        : null,
    };
  });

  rows.sort((a, b) => String(b.end_date ?? "").localeCompare(String(a.end_date ?? "")));
  return NextResponse.json([...hotelRows, ...shopProductRows, ...rows]);
}
