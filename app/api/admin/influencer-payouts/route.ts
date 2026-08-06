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
  type BusinessType,
} from "@/lib/settlement";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 정산 확정 — 서버가 전부 재계산해서 influencer_payouts에 스냅샷 동결
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaign_id, influencer_id } = await req.json();
  if (!campaign_id || !influencer_id) {
    return NextResponse.json({ error: "campaign_id / influencer_id 필요" }, { status: 400 });
  }

  // 이미 지급완료면 재확정 금지 (지급 취소 후 가능)
  const existing = await shopPool.query(
    "SELECT status FROM influencer_payouts WHERE campaign_id = $1 AND influencer_id = $2",
    [campaign_id, influencer_id]
  );
  if (existing.rows[0]?.status === "paid") {
    return NextResponse.json({ error: "이미 지급완료된 정산입니다. 지급 취소 후 재확정하세요." }, { status: 409 });
  }

  const isHotel = campaign_id === HOTEL_PAYOUT_CAMPAIGN_ID;

  // 버킷 종류 판별: 호텔(센티널) / 캠페인(OS) / 상품공구(products_shop.id)
  let rate: number | null = null;
  let bucket: "hotel" | "campaign" | "product" = "campaign";
  if (isHotel) {
    bucket = "hotel";
    rate = HOTEL_COMMISSION_RATE;
  } else {
    const c = await pool.query(
      "SELECT commission_rate FROM campaigns WHERE id = $1 AND influencer_id = $2",
      [campaign_id, influencer_id]
    );
    if (c.rows[0]) {
      rate = c.rows[0].commission_rate;
    } else {
      const p = await shopPool.query("SELECT influencer_rate FROM products_shop WHERE id = $1", [campaign_id]);
      if (p.rows[0]) {
        bucket = "product";
        rate = p.rows[0].influencer_rate != null ? Number(p.rows[0].influencer_rate) : null;
      }
    }
  }
  const influencer = await pool.query("SELECT business_type FROM influencers WHERE id = $1", [influencer_id]);
  const businessType = influencer.rows[0]?.business_type as BusinessType | undefined;
  if (rate == null) return NextResponse.json({ error: "수수료율이 설정되지 않은 공구입니다" }, { status: 400 });
  if (!businessType) return NextResponse.json({ error: "인플루언서 사업자유형이 미설정입니다" }, { status: 400 });

  // Shop: 매출 재집계 (버킷별 기준)
  const sales =
    bucket === "hotel"
      ? await shopPool.query(
          `SELECT COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
           FROM orders
           WHERE order_type = 'hotel' AND influencer_id = $1 AND status = ANY($2)`,
          [influencer_id, [...COUNTABLE_ORDER_STATUSES]]
        )
      : bucket === "product"
      ? await shopPool.query(
          // EXISTS로 대상 주문만 고른다 — order_items JOIN은 옵션 줄 수만큼 금액이 중복 합산됨
          `SELECT COALESCE(SUM(o.total_amount - o.shipping_fee), 0) AS gross
           FROM orders o
           WHERE o.order_type = 'shop' AND o.influencer_id = $2
             AND o.campaign_id IS NULL AND o.status = ANY($3)
             AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = $1)`,
          [campaign_id, influencer_id, [...COUNTABLE_ORDER_STATUSES]]
        )
      : await shopPool.query(
          `SELECT COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
           FROM orders
           WHERE campaign_id = $1 AND influencer_id = $2 AND status = ANY($3)`,
          [campaign_id, influencer_id, [...COUNTABLE_ORDER_STATUSES]]
        );
  const gross = Number(sales.rows[0].gross);
  const commission = calcCommission(gross, Number(rate));
  const b = calcPayout(commission, businessType);

  const { rows } = await shopPool.query(
    `INSERT INTO influencer_payouts (
       campaign_id, influencer_id, business_type, gross_sales, commission_rate,
       commission, supply_value, vat, withholding, payout_amount, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
     ON CONFLICT (campaign_id, influencer_id) DO UPDATE SET
       business_type = EXCLUDED.business_type,
       gross_sales = EXCLUDED.gross_sales,
       commission_rate = EXCLUDED.commission_rate,
       commission = EXCLUDED.commission,
       supply_value = EXCLUDED.supply_value,
       vat = EXCLUDED.vat,
       withholding = EXCLUDED.withholding,
       payout_amount = EXCLUDED.payout_amount,
       status = 'pending',
       updated_at = NOW()
     RETURNING id`,
    [campaign_id, influencer_id, businessType, gross, rate, b.commission, b.supplyValue, b.vat, b.withholding, b.payout]
  );

  return NextResponse.json({ ok: true, id: rows[0].id, payout: b }, { status: 201 });
}
