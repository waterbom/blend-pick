import ShippingFlowClient from "@/components/admin/ShippingFlowClient";

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; requestId?: string }> }) {
  const query = await searchParams;
  const initialTab = query.tab === "exchange_requested" || query.tab === "return_requested" ? query.tab : "preparing";
  const requestId = typeof query.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.requestId) ? query.requestId : undefined;
  return <ShippingFlowClient key={`${initialTab}-${requestId ?? ''}`} initialTab={initialTab} initialRequestId={requestId} />;
}
