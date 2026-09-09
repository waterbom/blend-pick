import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {verifyAdminToken} from '@/lib/auth';
import {currentAdminSite} from '@/lib/admin-site';
import pool from '@/lib/db-shop';
export async function POST(req:Request){
 const token=(await cookies()).get('admin_token')?.value;
 if(!token||!await verifyAdminToken(token))return NextResponse.json({error:'Unauthorized'},{status:401});
 const site=(await currentAdminSite()).key;
 const b=await req.json().catch(()=>null);
 if(!b||!/^\d+$/.test(b.id)||!['sent','retry'].includes(b.action)||b.confirmed!==true)return NextResponse.json({error:'잘못된 요청'},{status:400});
 const r=await pool.query(`UPDATE shipment_notifications n SET status=$3,attempts=CASE WHEN $3='retry' THEN 0 ELSE attempts END,
 body=CASE WHEN $3='sent' THEN '' ELSE body END,last_error='관리자 발송 이력 대조 완료',next_attempt_at=NOW(),updated_at=NOW()
 FROM orders o WHERE n.id=$1 AND n.site=$2 AND n.status='review' AND o.id=n.order_id AND o.site=$2
 AND o.status IN ('shipped','delivered') AND o.tracking_number=n.tracking_number RETURNING n.id`,[b.id,site,b.action]);
 return NextResponse.json({ok:!!r.rowCount},{status:r.rowCount?200:409});
}
