import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";
import { validDateRange } from "@/lib/order-finance";

type SaleItem = { id: string; product_id: string | null; product_ref: string | null; product_name: string; option_id: string | null; option_label: string | null; quantity: number };
type SaleReturn = { id: string; kind: string; status: string; items: unknown };
export type ProductSaleOrder = {
  id: string; status: string; refund_amount_unresolved: boolean; pending_refunds: boolean;
  unmapped_refunds: boolean; items: SaleItem[]; returns: SaleReturn[];
};
export type SalesCounts = { paid: number; cancelled: number; returned: number; sold: number; orders: number; review: number; pending: number };
export type ProductSales = SalesCounts & { options: (SalesCounts & { key: string; label: string })[] };
export const emptySalesCounts = (): SalesCounts => ({ paid: 0, cancelled: 0, returned: 0, sold: 0, orders: 0, review: 0, pending: 0 });

/** Count units, never infer returned units from refunded money. Add-ons are not products. */
export function summarizeProductSales(orders: ProductSaleOrder[]): Map<string, ProductSales> {
  type Bucket = { counts: SalesCounts; orders: Set<string>; review: Set<string>; pending: Set<string> };
  const bucket = (): Bucket => ({ counts: emptySalesCounts(), orders: new Set(), review: new Set(), pending: new Set() });
  const products = new Map<string, { total: Bucket; options: Map<string, Bucket & { label: string }> }>();
  for (const order of orders) {
    const byId = new Map(order.items.map(item => [item.id, item]));
    const returned = new Map<string, number>();
    let review = order.refund_amount_unresolved || order.pending_refunds || order.unmapped_refunds;
    const completed = order.returns.filter(r => r.kind === "return" && r.status === "done");
    if (order.status === "return_completed" && !completed.length) review = true;
    for (const request of completed) {
      if (!Array.isArray(request.items) || !request.items.length) { review = true; continue; }
      const seen = new Set<string>();
      for (const value of request.items) {
        const item = value && typeof value === "object" ? value as { item_id?: string; quantity?: unknown } : {};
        const source = item.item_id ? byId.get(item.item_id) : undefined;
        const quantity = Number(item.quantity);
        if (!source || !Number.isSafeInteger(quantity) || quantity < 1 || seen.has(source.id)) { review = true; continue; }
        seen.add(source.id);
        const sum = (returned.get(source.id) ?? 0) + quantity;
        if (sum > Number(source.quantity)) review = true;
        returned.set(source.id, Math.min(sum, Number(source.quantity)));
      }
    }
    const pending = order.status === "cancel_requested" || order.status === "return_requested" ||
      order.returns.some(r => r.kind === "return" && ["requested", "collecting"].includes(r.status));
    for (const item of order.items) {
      // These synthetic lines carry the parent's product_ref for financial attribution.
      // A deleted main product can also have product_id=null, so null alone is insufficient.
      if (!item.product_id && /^\[(추가|설치비)\]/.test(item.product_name)) continue;
      const productId = item.product_ref || item.product_id;
      if (!productId) continue;
      let product = products.get(productId);
      if (!product) { product = { total: bucket(), options: new Map() }; products.set(productId, product); }
      // Retain historical option identity even if the option has since been removed.
      const key = item.option_id || `label:${item.option_label || "기본 상품"}`;
      let option = product.options.get(key);
      if (!option) { option = { ...bucket(), label: item.option_label || "기본 상품" }; product.options.set(key, option); }
      const validQuantity = Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0;
      const paid = validQuantity ? Number(item.quantity) : 0;
      const cancelled = order.status === "cancelled" ? paid : 0;
      const returns = cancelled ? 0 : Math.min(paid, returned.get(item.id) ?? 0);
      for (const target of [product.total, option]) {
        target.counts.paid += paid;
        target.counts.cancelled += cancelled;
        target.counts.returned += returns;
        target.counts.sold += paid - cancelled - returns;
        target.orders.add(order.id);
        if (review || !validQuantity) target.review.add(order.id);
        if (pending) target.pending.add(order.id);
      }
    }
  }
  const finish = (b: Bucket): SalesCounts => ({ ...b.counts, orders: b.orders.size, review: b.review.size, pending: b.pending.size });
  return new Map([...products].map(([id, product]) => [id, {
    ...finish(product.total),
    options: [...product.options].map(([key, option]) => ({ key, label: option.label, ...finish(option) }))
      .sort((a, b) => b.sold - a.sold || a.label.localeCompare(b.label, "ko")),
  }]));
}

export async function getProductSales(site: SiteKey, from?: string, to?: string, db: Pick<typeof shopPool, "query"> = shopPool) {
  if (!validDateRange(from || null, to || null)) throw new Error("판매 집계 기간을 확인해주세요.");
  const args: unknown[] = [site];
  const where = ["o.site=$1", "o.order_type IN ('shop','campaign')", "o.paid_at IS NOT NULL",
    "NULLIF(o.payment_key,'') IS NOT NULL", "o.payment_key NOT LIKE 'SIM_%'", "o.status <> 'pending'"];
  if (from) { args.push(from); where.push(`o.paid_at >= ($${args.length}::date::timestamp AT TIME ZONE 'Asia/Seoul')`); }
  if (to) { args.push(to); where.push(`o.paid_at < (($${args.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')`); }
  // No buyer information is read. One row per order prevents item/return join multiplication.
  const { rows } = await db.query<ProductSaleOrder>(`SELECT o.id, o.status, o.refund_amount_unresolved,
    EXISTS(SELECT 1 FROM refund_operations ro WHERE ro.order_id=o.id AND ro.status NOT IN ('completed','rejected')) AS pending_refunds,
    EXISTS(SELECT 1 FROM order_refund_amounts ra WHERE ra.order_id=o.id AND ra.amount>0 AND o.status<>'cancelled'
      AND NOT EXISTS(SELECT 1 FROM order_returns rr WHERE rr.order_id=o.id AND rr.kind='return' AND rr.status='done' AND ra.source_key='return:'||rr.id::text)) AS unmapped_refunds,
    COALESCE(i.items,'[]'::jsonb) AS items, COALESCE(r.returns,'[]'::jsonb) AS returns
    FROM orders o
    LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('id',oi.id,'product_id',oi.product_id,'product_ref',oi.product_ref,
      'product_name',oi.product_name,'option_id',oi.option_id,'option_label',oi.option_label,'quantity',oi.quantity) ORDER BY oi.id) AS items
      FROM order_items oi WHERE oi.order_id=o.id) i ON true
    LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('id',rr.id,'kind',rr.kind,'status',rr.status,'items',rr.items) ORDER BY rr.id) AS returns
      FROM order_returns rr WHERE rr.order_id=o.id AND rr.kind='return' AND rr.status IN ('done','requested','collecting')) r ON true
    WHERE ${where.join(" AND ")} ORDER BY o.paid_at,o.id`, args);
  return summarizeProductSales(rows);
}
