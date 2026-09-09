import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { getVisitSummary } from '@/lib/visit-analytics/store';
import { analyticsRange, type VisitSummary } from '@/lib/visit-analytics/rules';
import MonitoringOverview from '@/components/admin/MonitoringOverview';
export const dynamic='force-dynamic';
export default async function VisitsPage({searchParams}:{searchParams:Promise<{days?:string}>}) {
  const token=(await cookies()).get('admin_token')?.value;
  if(!token || !(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin%2Fvisits');
  const site=await currentAdminSite();
  const params=await searchParams;
  const days=['1','7','30'].includes(params.days||'')?Number(params.days):7;
  let summary:VisitSummary;
  try {summary=await getVisitSummary(site.key,days);}catch{const {from,to}=analyticsRange(days);summary={site:site.key,days,state:'error',from:from.toISOString(),to:to.toISOString(),lastEventAt:null,totals:null,pages:[],daily:[]};}
  return <MonitoringOverview siteName={site.name} summary={summary} visitsOnly/>;
}
