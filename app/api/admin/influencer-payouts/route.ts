import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { influencerFinance } from "@/lib/influencer-finance";
export async function POST(req: Request) {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !await verifyAdminToken(token))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const { campaign_id, influencer_id } = await req.json();
    if (![campaign_id, influencer_id].every(v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)))
        return NextResponse.json({ error: '정산 대상을 확인해주세요.' }, { status: 400 });
    const row = (await influencerFinance(site)).find(r => r.campaign_id === campaign_id && r.influencer_id === influencer_id);
    if (!row || row.gross <= 0)
        return NextResponse.json({ error: '정산 대상 매출이 없습니다.' }, { status: 404 });
    if (!row.breakdown)
        return NextResponse.json({ error: row.review_reasons.join(', ') || '사업자유형을 확인해주세요.' }, { status: 409 });
    const b = row.breakdown;
    // The paid guard must be part of the write, not a separate SELECT before it.
    const result = await shopPool.query(`INSERT INTO influencer_payouts
 (campaign_id,influencer_id,business_type,gross_sales,commission_rate,commission,supply_value,vat,withholding,payout_amount,status,site)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)
 ON CONFLICT(site,campaign_id,influencer_id) DO UPDATE SET
 business_type=EXCLUDED.business_type,gross_sales=EXCLUDED.gross_sales,commission_rate=EXCLUDED.commission_rate,
 commission=EXCLUDED.commission,supply_value=EXCLUDED.supply_value,vat=EXCLUDED.vat,
 withholding=EXCLUDED.withholding,payout_amount=EXCLUDED.payout_amount,paid_at=NULL,updated_at=NOW()
 WHERE influencer_payouts.status='pending' RETURNING id`, [campaign_id, influencer_id, row.business_type, row.gross, row.gross ? b.commission * 100 / row.gross : 0, b.commission, b.supplyValue, b.vat, b.withholding, b.payout, site]);
    if (!result.rows.length)
        return NextResponse.json({ error: '이미 지급완료된 정산입니다. 새로고침해 확인해주세요.' }, { status: 409 });
    return NextResponse.json({ ok: true, id: result.rows[0].id, payout: b }, { status: 201 });
}
