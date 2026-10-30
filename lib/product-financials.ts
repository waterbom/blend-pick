import shopPool from '@/lib/db-shop';
import { allocate, validDateRange } from '@/lib/order-finance';
import type { SiteKey } from '@/lib/sites';

type MoneyLine = {
  id: string; product_id: string | null; product_ref: string | null;
  product_name: string; quantity: number; unit_price: number | null;
};
type MoneyRefund = { source_key: string; amount: number };
type MoneyReturn = { id: string; kind: string; status: string; items: unknown };
export type ProductMoneyOrder = {
  id: string; orderNumber: string; paidAt: string; status: string; channel: string;
  units: number; gross: number; refunds: number; shipping: number; shippingPaid: boolean;
  estimated: boolean; review: boolean;
};
export type ProductMoney = {
  gross: number; refunds: number; net: number | null; shipping: number;
  shippingPayments: number; orders: number; units: number;
  displayOrders: number; nonDisplayOrders: number; review: number; allocatedOrders: number;
  estimatedOrders: number; orderRows: ProductMoneyOrder[];
};
export type MoneySnapshot = {
  id: string; order_number?: string | null; paid_at: string; status: string;
  sales_channel?: string | null; total_amount: number; shipping_fee: number | null;
  refund_amount_unresolved: boolean; pending_refunds: boolean;
  items: MoneyLine[]; refund_rows: MoneyRefund[]; return_rows: MoneyReturn[];
};
export const emptyProductMoney = (): ProductMoney => ({
  gross: 0, refunds: 0, net: 0, shipping: 0, shippingPayments: 0, orders: 0,
  units: 0, displayOrders: 0, nonDisplayOrders: 0, review: 0,
  allocatedOrders: 0, estimatedOrders: 0, orderRows: [],
});
const productKey = (line: MoneyLine) => line.product_ref || line.product_id;
const isAddon = (line: MoneyLine) => !line.product_id && /^\[(추가|설치비)\]/.test(line.product_name || '');
const integer = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
const weightsFor = (entries: { weight: number }[]) => entries.map(x => x.weight);
const uuid = (value: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

/** Each order is allocated once, before grouping by product. Payment, refund and shipping
 * totals therefore never multiply when an order has multiple options/products.
 * Shipping counts are distinct paid orders containing the product, not parcel counts. */
export function summarizeProductFinancials(orders: MoneySnapshot[], detailed = false): Map<string, ProductMoney> {
  const result = new Map<string, ProductMoney>();
  for (const order of orders) {
    const lines = Array.isArray(order.items) ? order.items : [];
    if (!lines.length) continue;
    const keys = lines.map(productKey);
    const products = [...new Set(keys.filter((key): key is string => !!key))];
    if (!products.length) continue;

    const total = integer(order.total_amount) ? Number(order.total_amount) : 0;
    const shippingValid = integer(order.shipping_fee ?? 0) && Number(order.shipping_fee || 0) <= total;
    const shipping = shippingValid ? Number(order.shipping_fee || 0) : 0;
    const rawWeights = lines.map(line =>
      integer(line.quantity) && Number(line.quantity) > 0 && integer(line.unit_price)
        ? Number(line.quantity) * Number(line.unit_price) : 0);
    const hasUnknownPrice = lines.some(line => !integer(line.quantity) || Number(line.quantity) < 1 || !integer(line.unit_price));
    const missingKey = keys.some(key => !key);
    const noWeights = !rawWeights.some(Boolean);
    // A single-product basket is attributable in full even if its historic option price is missing.
    const weights = noWeights ? lines.map(() => 1) : rawWeights;
    const goodsByLine = allocate(Math.max(0, total - shipping), weights);
    const shippingByLine = allocate(shipping, weights);
    const paidByLine = goodsByLine.map((amount, i) => amount + shippingByLine[i]);
    const refundsByLine = lines.map(() => 0);
    const refundRows = Array.isArray(order.refund_rows) ? order.refund_rows : [];
    const returns = Array.isArray(order.return_rows) ? order.return_rows : [];
    let estimated = products.length > 1 || (hasUnknownPrice && products.length > 1) || missingKey;
    let refundTotal = 0;
    let refundInvalid = false;
    for (const refund of refundRows) {
      if (!integer(refund.amount)) { refundInvalid = true; continue; }
      const amount = Number(refund.amount);
      refundTotal += amount;
      let applicable = lines.map((_, i) => i);
      const match = /^return:(.+)$/.exec(refund.source_key || '');
      if (match) {
        const request = returns.find(r => r.id === match[1] && r.kind === 'return' && r.status === 'done');
        const chosen = Array.isArray(request?.items) ? request.items : [];
        const found = new Map<number, number>();
        for (const entry of chosen) {
          if (!entry || typeof entry !== 'object') continue;
          const v = entry as { item_id?: string; quantity?: unknown };
          const index = lines.findIndex(line => line.id === v.item_id);
          if (index < 0 || !integer(v.quantity) || Number(v.quantity) < 1) continue;
          found.set(index, (found.get(index) || 0) + Number(v.quantity));
        }
        if (found.size) applicable = [...found.keys()];
        else estimated = true;
      } else if (refundRows.length && products.length > 1) {
        // Legacy/cancellation refunds have only an order amount, not an item identity.
        estimated = true;
      }
      const shares = allocate(amount, applicable.map(i =>
        Math.max(1, (match ? (rawWeights[i] || paidByLine[i]) : paidByLine[i]) *
          (match ? Math.max(1, Number((returns.find(r => r.id === match[1])?.items as Array<{item_id?: string; quantity?: number}> | undefined)
            ?.find(x => x?.item_id === lines[i].id)?.quantity || 1)) : 1))));
      applicable.forEach((i, n) => { refundsByLine[i] += shares[n]; });
    }
    const invalid = !integer(order.total_amount) || !shippingValid || refundInvalid ||
      refundTotal > total || !!order.refund_amount_unresolved || !!order.pending_refunds ||
      (['cancelled', 'return_completed'].includes(order.status) && !refundRows.length) ||
      (products.length > 1 && (hasUnknownPrice || noWeights || missingKey));
    const channel = order.sales_channel === 'non_display' ? 'non_display' : 'display';
    for (const id of products) {
      let row = result.get(id);
      if (!row) { row = emptyProductMoney(); result.set(id, row); }
      let gross = 0, refund = 0, delivery = 0, units = 0;
      lines.forEach((line, i) => {
        if (keys[i] !== id) return;
        gross += paidByLine[i];
        refund += refundsByLine[i];
        delivery += shippingByLine[i];
        if (!isAddon(line) && integer(line.quantity)) units += Number(line.quantity);
      });
      const review = invalid || refund > gross;
      row.gross += gross;
      row.refunds += refund;
      row.shipping += delivery;
      row.orders++;
      row.units += units;
      if (shipping > 0) row.shippingPayments++;
      if (channel === 'non_display') row.nonDisplayOrders++;
      else row.displayOrders++;
      if (products.length > 1) row.allocatedOrders++;
      if (estimated) row.estimatedOrders++;
      if (review) { row.review++; row.net = null; }
      else if (row.net !== null) row.net += gross - refund;
      if (detailed) row.orderRows.push({
        id: order.id, orderNumber: order.order_number || order.id.slice(0, 8),
        paidAt: order.paid_at, status: order.status, channel, units, gross, refunds: refund,
        shipping: delivery, shippingPaid: shipping > 0, estimated, review,
      });
    }
  }
  if (detailed) for (const row of result.values())
    row.orderRows.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)) || a.id.localeCompare(b.id));
  return result;
}

export async function getProductFinancials(
  site: SiteKey, from?: string, to?: string, productId?: string,
  db: Pick<typeof shopPool, 'query'> = shopPool,
): Promise<Map<string, ProductMoney>> {
  if (!validDateRange(from || null, to || null)) throw new Error('판매 집계 기간을 확인해주세요.');
  if (productId && !uuid(productId)) throw new Error('상품 식별자를 확인해주세요.');
  const args: unknown[] = [site];
  const conditions = [
    'o.site=$1', "o.order_type IN ('shop','campaign')", 'o.paid_at IS NOT NULL',
    "NULLIF(o.payment_key,'') IS NOT NULL", "o.payment_key NOT LIKE 'SIM_%'", "o.status <> 'pending'",
  ];
  if (from) { args.push(from); conditions.push('o.paid_at >= ($' + args.length + "::date::timestamp AT TIME ZONE 'Asia/Seoul')"); }
  if (to) { args.push(to); conditions.push('o.paid_at < (($' + args.length + "::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')"); }
  if (productId) {
    args.push(productId);
    conditions.push('EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND COALESCE(oi.product_ref,oi.product_id)=$' + args.length + '::uuid)');
  }
  const sql = [
    'SELECT o.id,o.order_number,o.paid_at,o.status,o.sales_channel,o.total_amount,o.shipping_fee,o.refund_amount_unresolved,',
    "EXISTS(SELECT 1 FROM refund_operations ro WHERE ro.order_id=o.id AND ro.status NOT IN ('completed','rejected')) AS pending_refunds,",
    "COALESCE(i.items,'[]'::jsonb) AS items,COALESCE(r.refund_rows,'[]'::jsonb) AS refund_rows,",
    "COALESCE(t.return_rows,'[]'::jsonb) AS return_rows",
    'FROM orders o',
    "LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('id',oi.id,'product_id',oi.product_id,'product_ref',oi.product_ref,",
    "'product_name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price) ORDER BY oi.id) AS items",
    'FROM order_items oi WHERE oi.order_id=o.id) i ON true',
    "LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('source_key',ra.source_key,'amount',ra.amount) ORDER BY ra.source_key) AS refund_rows",
    'FROM order_refund_amounts ra WHERE ra.order_id=o.id) r ON true',
    "LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('id',rr.id,'kind',rr.kind,'status',rr.status,'items',rr.items) ORDER BY rr.id) AS return_rows",
    "FROM order_returns rr WHERE rr.order_id=o.id AND rr.kind='return' AND rr.status='done') t ON true",
    'WHERE ' + conditions.join(' AND '),
    'ORDER BY o.paid_at,o.id',
  ].join('\n');
  const { rows } = await db.query<MoneySnapshot>(sql, args);
  return summarizeProductFinancials(rows, !!productId);
}
