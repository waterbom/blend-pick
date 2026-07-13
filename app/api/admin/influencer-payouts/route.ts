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

  // OS: 요율 + 사업자유형 (호텔은 공통 요율 상수 사용)
  const [campaign, influencer] = await Promise.all([
    isHotel
      ? Promise.resolve({ rows: [{ commission_rate: HOTEL_COMMISSION_RATE }] })
      : pool.query("SELECT commission_rate FROM campaigns WHERE id = $1 AND influencer_id = $2", [
          campaign_id,
          influencer_id,
        ]),
    pool.query("SELECT business_type FROM influencers WHERE id = $1", [influencer_id]),
  ]);
  const rate = campaign.rows[0]?.commission_rate;
  const businessType = influencer.rows[0]?.business_type as BusinessType | undefined;
  if (rate == null) return NextResponse.json({ error: "수수료율이 설정되지 않은 공구입니다" }, { status: 400 });
  if (!businessType) return NextResponse.json({ error: "인플루언서 사업자유형이 미설정입니다" }, { status: 400 });

  // Shop: 매출 재집계 (호텔은 order_type='hotel' + influencer_id 기준)
  const sales = isHotel
    ? await shopPool.query(
        `SELECT COALESCE(SUM(total_amount - shipping_fee), 0) AS gross
         FROM orders
         WHERE order_type = 'hotel' AND influencer_id = $1 AND status = ANY($2)`,
        [influencer_id, [...COUNTABLE_ORDER_STATUSES]]
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
