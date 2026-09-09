type SaleProduct = {status: string; stock: number; sale_start_at: string | null; sale_end_at: string | null};
export function storefrontSale(p: SaleProduct, now = Date.now()): "open" | "upcoming" | "closed" {
  if (p.status !== "active" || p.stock === 0) return "closed";
  const start = p.sale_start_at ? Date.parse(p.sale_start_at) : null;
  const end = p.sale_end_at ? Date.parse(p.sale_end_at) : null;
  if ((start !== null && !Number.isFinite(start)) || (end !== null && !Number.isFinite(end))) return "closed";
  if (end !== null && end <= now) return "closed";
  return start !== null && start > now ? "upcoming" : "open";
}
