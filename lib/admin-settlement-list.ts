import { settlementInPeriod } from "@/lib/settlement-period";
import type { SiteKey } from "@/lib/sites";

export interface SettlementListRow {
  id: string; order_id: string; order_number: string | null; buyer_name: string | null;
  site: SiteKey; settled_at: string; gross_amount: number; fee: number; net_amount: number | null;
  unresolved: boolean; fee_estimated: boolean;
}
export interface SettlementListFilters { period?: string; q?: string; check?: string; page?: string }
export const SETTLEMENT_PERIODS = [{key: "today", label: "오늘"}, {key: "week", label: "이번 주"}, {key: "month", label: "이번 달"}, {key: "", label: "전체 기간"}];
export function settlementList(rows: SettlementListRow[], filters: SettlementListFilters, now: Date) {
  const period = SETTLEMENT_PERIODS.some(p => p.key === filters.period) ? filters.period! : "";
  const selected = rows.filter(r => settlementInPeriod(r.settled_at, period, now));
  const q = (filters.q ?? "").trim().toLowerCase();
  const check = filters.check === "unresolved" ? "unresolved" : "";
  const filtered = selected.filter(r => (!check || r.unresolved || r.net_amount == null) && (!q || [r.order_number, r.buyer_name].some(v => v?.toLowerCase().includes(q))));
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const value = Number(filters.page), page = Number.isSafeInteger(value) && value > 0 ? Math.min(value, pages) : 1;
  return { period, check, selected, filtered, pages, page, rows: filtered.slice((page - 1) * 50, page * 50) };
}
