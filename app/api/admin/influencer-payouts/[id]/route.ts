import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { influencerFinance } from "@/lib/influencer-finance";
import shopPool from "@/lib/db-shop";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
// 지급완료 / 지급취소
export async function PATCH(req: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const { id } = await params;
    const { status } = await req.json();
    if (status !== "paid" && status !== "pending") {
        return NextResponse.json({ error: "status는 paid 또는 pending" }, { status: 400 });
    }
    const client=await shopPool.connect();
    try {
      await client.query('BEGIN');
      const revision=(await client.query('SELECT version FROM finance_revisions WHERE site=$1 FOR UPDATE',[site])).rows[0];
      if(!revision)throw new Error('정산 버전 확인 실패');
      const current = await client.query('SELECT * FROM influencer_payouts WHERE id=$1 AND site=$2 FOR UPDATE', [id, site]);
      const old = current.rows[0];
      if (!old) { await client.query('ROLLBACK'); return NextResponse.json({error:'Not found'},{status:404}); }
      if (old.status === status) { await client.query('COMMIT'); return NextResponse.json({ok:true}); }
      if(status==='paid') {
        const latest=(await influencerFinance(site,client)).find(r=>r.campaign_id===old.campaign_id && r.influencer_id===old.influencer_id);
        if(!latest?.breakdown || latest.breakdown.payout!==Number(old.payout_amount) || latest.gross!==Number(old.gross_sales) || latest.business_type!==old.business_type || latest.breakdown.commission!==Number(old.commission) || latest.breakdown.withholding!==Number(old.withholding)) {
          await client.query('ROLLBACK');
          return NextResponse.json({error:'환불 또는 정산 대상 금액이 변경되었습니다. 다시 확정한 후 지급 처리해주세요.'},{status:409});
        }
      }
      const r=await client.query(`UPDATE influencer_payouts SET status=$1,paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,NOW()) ELSE NULL END,updated_at=NOW()
        WHERE id=$2 AND site=$3 AND status=$4 AND payout_amount=$5 AND gross_sales=$6
        AND EXISTS(SELECT 1 FROM finance_revisions WHERE site=$3 AND version=$7) RETURNING id`,[status,id,site,old.status,old.payout_amount,old.gross_sales,revision.version]);
      if(!r.rows.length) { await client.query('ROLLBACK'); return NextResponse.json({error:'정산 정보가 변경되었습니다. 새로고침해주세요.'},{status:409}); }
      await client.query('COMMIT');
      return NextResponse.json({ok:true});
    } catch(e) {
      await client.query('ROLLBACK');
      console.error('[influencer-payouts] 지급 상태 저장 실패',e);
      return NextResponse.json({error:'지급 상태를 저장하지 못했습니다. 다시 확인해주세요.'},{status:503});
    } finally {client.release();}
}
