import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import { currentAdminSite } from "@/lib/admin-site";
import { settlementView } from "@/lib/settlement-view";
import SettlementsListView from "@/components/admin/SettlementsListView";
import type { SettlementListFilters, SettlementListRow } from "@/lib/admin-settlement-list";

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SettlementListFilters> }) {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token || !await verifyAdminToken(token)) redirect("/login");
  const site = (await currentAdminSite()).key;
  const raw = await searchParams;
  const filters = Object.fromEntries(Object.entries(raw).filter(([,value]) => typeof value === "string")) as SettlementListFilters;
  let rows: SettlementListRow[] | null = null;
  try {
    const all = await settlementView(site);
    // Explicit display fields only; payment keys and other settlement metadata stay server-side.
    rows = all.map(r => ({ id: r.id, order_id: r.order_id, order_number: r.order_number ?? null, buyer_name: r.buyer_name ?? null,
      site, settled_at: new Date(r.settled_at).toISOString(), gross_amount: Number(r.gross_amount), fee: Number(r.fee),
      net_amount: r.net_amount == null ? null : Number(r.net_amount), unresolved: !!r.unresolved, fee_estimated: !!r.fee_estimated }));
  } catch (error) { console.error("[admin/settlements] lookup failed", error); }
  return <SettlementsListView all={rows} filters={filters} now={new Date().toISOString()} />;
}
