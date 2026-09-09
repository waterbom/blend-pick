import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifyAdminToken} from '@/lib/auth';
import {currentAdminSite} from '@/lib/admin-site';
import pool from '@/lib/db-shop';
import NotificationActions from '@/components/admin/NotificationActions';
export const dynamic='force-dynamic';
export default async function Page(){
 const token=(await cookies()).get('admin_token')?.value;
 if(!token||!await verifyAdminToken(token))redirect('/login');
 const site=await currentAdminSite();
 const {rows}=await pool.query(`SELECT n.id::text,n.status,n.attempts,n.last_error,n.updated_at,o.order_number FROM shipment_notifications n
 JOIN orders o ON o.id=n.order_id WHERE n.site=$1 AND o.site=$1 ORDER BY n.updated_at DESC LIMIT 100`,[site.key]);
 return <main style={{padding:24}}><h1>배송 안내 발송 관리</h1><p>발송 접수는 고객 수신 완료와 다릅니다. 결과 확인 항목은 발송업체 이력을 먼저 확인하세요. 최근 100건을 표시합니다.</p>
 <a href="/admin/operations">오늘 처리할 일</a><table style={{width:'100%',marginTop:20}}><thead><tr><th>주문</th><th>상태</th><th>시도</th><th>사유</th><th>처리</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.order_number}</td><td>{({pending:'발송 대기',retry:'재시도 대기',review:'결과 확인 필요',sending:'발송 처리 중',sent:'접수 완료',cancelled:'대상 제외'} as Record<string,string>)[r.status]}</td><td>{r.attempts}</td><td>{r.last_error||'—'}</td><td><NotificationActions id={r.id} status={r.status}/></td></tr>)}</tbody></table></main>;
}
