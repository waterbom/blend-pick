import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import { currentAdminSite } from "@/lib/admin-site";
import { getAutomationWork } from "@/lib/automation-work";
import ShippingFlowClient from "@/components/admin/ShippingFlowClient";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; requestId?: string }> }) {
  const token=(await cookies()).get("admin_token")?.value;
  if(!token || !await verifyAdminToken(token)) redirect("/login");
  const site=await currentAdminSite();
  const groups=(await getAutomationWork(site.key)).filter(g=>g.key!=="payment-recovery");
  const query = await searchParams;
  const initialTab = query.tab === "exchange_requested" || query.tab === "return_requested" ? query.tab : "preparing";
  const requestId = typeof query.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.requestId) ? query.requestId : undefined;
  return <ShippingFlowClient key={`${initialTab}-${requestId ?? ''}`} initialTab={initialTab} initialRequestId={requestId} automationWork={groups} />;
}
