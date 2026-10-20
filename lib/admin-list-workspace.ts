import { orderQueue, type DispatchOrder } from '@/lib/admin-workflow';

export const ACTIVE_SHIPMENT_STATUSES = ['preparing', 'shipped'];
export const COMPLETED_SHIPMENT_STATUSES = ['delivered', 'cancelled', 'exchange_completed', 'return_completed'];

export function shipmentStatusMatches(status: string, filter: string) {
  return filter === 'active' ? ACTIVE_SHIPMENT_STATUSES.includes(status)
    : filter === 'history' ? COMPLETED_SHIPMENT_STATUSES.includes(status)
    : status === filter;
}

export function matchesOrderSearch(order: {
  order_number: string; buyer_name?: string; recipient_name?: string | null;
  buyer_phone?: string; recipient_phone?: string | null; tracking_number?: string | null;
  influencer_name?: string | null;
  items: { product_name: string; option_label?: string | null; supplier_name?: string | null }[];
}, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const words = [order.order_number, order.buyer_name, order.recipient_name, order.tracking_number,
    order.influencer_name, ...order.items.flatMap(i => [i.product_name, i.option_label, i.supplier_name])];
  const digits = q.replace(/\D/g, '');
  return words.some(value => String(value || '').toLowerCase().includes(q)) || digits.length >= 3 &&
    [order.buyer_phone, order.recipient_phone].some(value => (value || '').replace(/\D/g, '').includes(digits));
}

// Never silently apply an action to only part of a mixed/obsolete selection.
export function selectionAction(orders: (DispatchOrder & { id: string })[], selected: Set<string>) {
  if (!selected.size) return 'none';
  const rows = orders.filter(o => selected.has(o.id));
  if (rows.length !== selected.size) return 'mixed';
  if (rows.every(o => orderQueue(o) === 'ready')) return 'dispatch';
  if (rows.every(o => o.status === 'preparing')) return 'tracking';
  if (rows.every(o => o.status === 'shipped')) return 'deliver';
  if (rows.every(o => o.status === 'cancel_requested')) return 'cancel';
  return 'mixed';
}
