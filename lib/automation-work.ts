import pool from '@/lib/db-shop';
import type { SiteKey } from '@/lib/sites';
import type { WorkGroup } from '@/lib/operations';
export async function getAutomationWork(site: SiteKey): Promise<WorkGroup[]> {
 const specs = [
  {key:'sms',title:'배송 안내 발송 대기·확인',explanation:'자동 재시도는 확실히 거절된 발송만 대상으로 합니다. 결과가 불명확하면 발송업체 이력을 먼저 대조하세요.',
   sql:`SELECT n.id::text id,o.order_number label,n.status||' · '||n.attempts||'회 시도 · '||COALESCE(n.last_error,'발송 대기') detail,
    n.updated_at,n.next_attempt_at,COUNT(*) OVER() total FROM shipment_notifications n JOIN orders o ON o.id=n.order_id
    WHERE n.site=$1 AND o.site=$1 AND n.status IN ('pending','retry','review') AND o.status IN ('shipped','delivered')
    ORDER BY CASE WHEN n.status='review' THEN 0 ELSE 1 END,n.created_at LIMIT 30`,href:'/admin/shipment-notifications',action:'발송 이력 확인',resolved:'발송 접수 성공·확인 완료 또는 주문 취소 시 제외됩니다.'},
  {key:'tracking-errors',title:'배송 조회 실패',explanation:'택배사 조회에 실패한 주문입니다. 송장을 보완하거나 조회 서비스 설정을 확인하세요.',
   sql:`SELECT o.id::text id,o.order_number label,c.error||' · 연속 '||c.failures||'회' detail,c.checked_at updated_at,c.next_attempt_at,COUNT(*) OVER() total
    FROM shipment_tracking_checks c JOIN orders o ON o.id=c.order_id WHERE o.site=$1 AND o.status='shipped' AND c.error IS NOT NULL AND c.tracking_number=o.tracking_number
    ORDER BY c.failures DESC,c.checked_at LIMIT 30`,href:'/admin/shipments',action:'배송 조회·송장 확인',resolved:'조회 성공 또는 배송 단계 종료 시 제외됩니다.'},
  {key:'payment-recovery',title:'결제 상태 확인·복구',explanation:'미완료 결제 시도 중 확인이 필요한 항목입니다. 결제 재승인 전에 PG 상태를 먼저 조회합니다.',
   sql:`SELECT provider_order_id::text id,provider_order_id label,status detail,updated_at,NULL::timestamptz next_attempt_at,COUNT(*) OVER() total
    FROM payment_attempts WHERE site=$1 AND status NOT IN ('completed','failed') AND updated_at<NOW()-INTERVAL '10 minutes' ORDER BY created_at LIMIT 30`,href:'/admin/payment-recovery',action:'결제 복구 확인',resolved:'결제 시도가 완료 또는 실패로 확정되면 제외됩니다.'}
 ];
 return Promise.all(specs.map(async s=>{const {rows}=await pool.query(s.sql,[site]);return {key:s.key,title:s.title,explanation:s.explanation,total:Number(rows[0]?.total||0),
  steps:['사유와 마지막 실행 시각 확인',s.action,'처리 결과 확인'],resolvedWhen:s.resolved,sortLabel:'확인 필요·오래된 항목 우선',
  items:rows.map(r=>({id:r.id,label:r.label,detail:r.detail,href:s.href,priority:'first' as const,nextAction:s.explanation,actionLabel:s.action,
   elapsed:`최근 확인 ${new Date(r.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST${r.next_attempt_at?` · 다음 자동 처리 대상 ${new Date(r.next_attempt_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} KST`:''}`}))};}));
}
