import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifyAdminToken} from '@/lib/auth';
import AdminDashboardView from '@/components/admin/AdminDashboardView';
import {getSalesSummary} from '@/lib/sales-statistics';
import {currentAdminSite} from '@/lib/admin-site';
import {SITES,type SiteKey} from '@/lib/sites';
import shopPool from '@/lib/db-shop';
import {settlementTotal,settlementView} from '@/lib/settlement-view';
import {reportApiError} from '@/lib/api-errors';
import {getTodayWork} from '@/lib/operations';
import {getAutomationWork} from '@/lib/automation-work';
import {getVisitSummary} from '@/lib/visit-analytics/store';
import {analyticsRange,type VisitSummary} from '@/lib/visit-analytics/rules';
import {getServerTraffic} from '@/lib/server-traffic';
export const dynamic='force-dynamic';
async function getStats(site:SiteKey){
 const [gongu,queue]=await Promise.all([
  shopPool.query(`SELECT
   COUNT(*) FILTER (WHERE status='active' AND sale_type='groupbuy' AND (sale_start_at IS NULL OR sale_start_at<=NOW()) AND (sale_end_at IS NULL OR sale_end_at>=NOW())) AS live_gongu,
   COUNT(*) FILTER (WHERE status='active' AND sale_start_at>NOW()) AS upcoming
   FROM products_shop WHERE CASE WHEN $1='sanjipick' THEN category=ANY($2::text[]) ELSE NOT COALESCE(category=ANY($2::text[]),false) END`,[site,SITES.sanjipick.categories]),
  shopPool.query(`SELECT COUNT(*) FILTER (WHERE status IN ('paid','confirmed')) AS new_orders,
   COUNT(*) FILTER (WHERE status='preparing') AS preparing_orders,COUNT(*) FILTER (WHERE status='shipped') AS shipped_orders
   FROM orders WHERE site=$1 AND order_type IN ('shop','campaign')`,[site]),
 ]);
 return {g:gongu.rows[0],q:queue.rows[0]};
}
export default async function AdminDashboard({searchParams}:{searchParams:Promise<{days?:string}>}){
 // Parent layouts can render concurrently; authenticate before any dashboard reads.
 const token=(await cookies()).get('admin_token')?.value;
 if(!token||!(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin');
 const site=await currentAdminSite(),params=await searchParams;
 const days=['1','7','30'].includes(params.days||'')?Number(params.days):7;
 const failed=(operation:string)=>(error:unknown)=>{reportApiError(error,operation);return null;};
 const [counts,sales,settlements,work,automation,visitResult,traffic]=await Promise.all([
  getStats(site.key).catch(failed('admin.dashboard.counts')),
  getSalesSummary(site.key,days).catch(failed('admin.dashboard.sales')),
  settlementView(site.key).catch(failed('admin.dashboard.settlements')),
  getTodayWork(site.key).catch(failed('admin.dashboard.work')),
  getAutomationWork(site.key).catch(failed('admin.dashboard.automation')),
  getVisitSummary(site.key,days).catch(failed('admin.dashboard.visits')),
  getServerTraffic(site.key,1),
 ]);
 const stats=counts?{liveGongu:Number(counts.g.live_gongu),upcoming:Number(counts.g.upcoming),newOrders:Number(counts.q.new_orders),preparingOrders:Number(counts.q.preparing_orders),shippedOrders:Number(counts.q.shipped_orders),todaySettlement:settlements?settlementTotal(settlements,'today'):null}:null;
 const {from,to}=analyticsRange(days);
 const visits:VisitSummary=visitResult??{site:site.key,days,state:'error',from:from.toISOString(),to:to.toISOString(),lastEventAt:null,totals:null,pages:[],daily:[]};
 const date=new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});
 return <AdminDashboardView siteKey={site.key} siteName={site.name} date={date} stats={stats} sales={sales} visits={visits} workGroups={[...(work??[]),...(automation??[])]} workUnavailable={[...(work===null?['주문·재고 업무']:[]),...(automation===null?['자동 처리 확인']:[])]} traffic={traffic}/>;
}
