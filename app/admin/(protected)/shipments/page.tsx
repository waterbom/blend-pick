import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import { currentAdminSite } from "@/lib/admin-site";
import { reportApiError } from "@/lib/api-errors";
import { getAutomationWork } from "@/lib/automation-work";
import {getReturnSummary} from '@/lib/admin-insights-db';
import {readReturnRange,readReturnListFilter} from '@/lib/admin-insights';
import ReturnInsights from '@/components/admin/charts/ReturnInsights';
import ShippingFlowClient from "@/components/admin/ShippingFlowClient";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const token=(await cookies()).get("admin_token")?.value;
  if(!token || !await verifyAdminToken(token)) redirect("/login");
  const site=await currentAdminSite(),query=await searchParams;
  const {range,error}=readReturnRange(query);
  const analysisFilter=query.returnsDrill==='1'&&range?readReturnListFilter(query,range):null;
  const [work,insights]=await Promise.all([
    getAutomationWork(site.key).catch(error=>{reportApiError(error,"admin.shipments.automation");return null;}),
    range?getReturnSummary(site.key,range).catch(error=>{reportApiError(error,"admin.shipments.return-insights");return null;}):Promise.resolve(null),
  ]);
  const groups=(work??[]).filter(g=>g.key!=="payment-recovery");
  const initialTab=query.tab==="exchange_requested"||query.tab==="return_requested"?query.tab:"preparing";
  const requestId=!analysisFilter&&typeof query.requestId==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.requestId)?query.requestId:undefined;
  return <ShippingFlowClient key={JSON.stringify([initialTab,requestId,analysisFilter])} initialTab={initialTab} initialRequestId={requestId} automationWork={groups} automationUnavailable={work===null}
    analysisFilter={analysisFilter} returnInsights={<ReturnInsights data={insights} range={range??readReturnRange({}).range!} error={error||(query.returnsDrill==='1'&&!analysisFilter?'차트 조회 조건을 확인해주세요.':'')}/>}/>;
}
