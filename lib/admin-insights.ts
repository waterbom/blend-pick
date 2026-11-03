import { RETURN_REASONS } from '@/lib/returns';
import type { ProductSales } from '@/lib/product-sales';
import type { ProductMoney } from '@/lib/product-financials';

export const AGE_BUCKETS = [
  { key: 'day1', label: '1일 미만', color: '#7396b5', start: 0, end: 24 },
  { key: 'day3', label: '1~3일 미만', color: '#c59b4c', start: 24, end: 72 },
  { key: 'day7', label: '3~7일 미만', color: '#ca7954', start: 72, end: 168 },
  { key: 'older', label: '7일 이상', color: '#a94545', start: 168, end: null },
] as const;
export const QUEUE_BUCKETS = [...AGE_BUCKETS,
  { key: 'planned', label: '예약 출고', color: '#57836b' },
  { key: 'unknown', label: '시각 확인', color: '#99949e' },
] as const;
export const QUEUE_STATUSES = [
  { key: 'paid', label: '결제 완료' }, { key: 'confirmed', label: '주문 확인' },
  { key: 'preparing', label: '배송 준비' }, { key: 'shipped', label: '배송 중' },
] as const;
export type QueueBucket = typeof QUEUE_BUCKETS[number]['key'];
export type QueueStatus = typeof QUEUE_STATUSES[number]['key'];
export type QueueOrder = {
  status: string; order_type: string; paid_at?: string | Date | null; test_payment?: boolean;
  items?: { product_id?: string | null; product_name?: string; expected_ship_date?: string | null }[];
};
export type QueueFilter = { status: QueueStatus; bucket: QueueBucket; at: string };
export type QueueSummary = { at: string; total: number; rows: { status: QueueStatus; label: string; total: number; values: number[] }[] };
const timestamp = (value: string | Date | null | undefined) => value == null ? NaN : new Date(value).getTime();
export const kstDateKey = (at: number) => new Date(at + 9 * 3600000).toISOString().slice(0, 10);
export function validInsightDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function ageBucket(hours: number): typeof AGE_BUCKETS[number]['key'] | 'unknown' {
  if (!Number.isFinite(hours) || hours < 0) return 'unknown';
  return AGE_BUCKETS.find(bucket => bucket.end === null || hours < bucket.end)!.key;
}
export function queueBucket(order: QueueOrder, at: string): QueueBucket | null {
  if (!QUEUE_STATUSES.some(s => s.key === order.status) || !['shop', 'campaign'].includes(order.order_type) || order.test_payment) return null;
  const now = timestamp(at), paid = timestamp(order.paid_at);
  if (!Number.isFinite(now) || !Number.isFinite(paid) || paid > now) return 'unknown';
  const main = (order.items ?? []).filter(item => !(item.product_id == null && /^\[(추가|설치비)\]/.test(item.product_name ?? '')));
  if (order.status !== 'shipped' && main.length && main.every(item => {
    const date = item.expected_ship_date?.slice(0, 10) ?? '';
    return validInsightDate(date) && date > kstDateKey(now);
  })) return 'planned';
  return ageBucket((now - paid) / 3600000);
}
export function summarizeQueue(orders: QueueOrder[], at: string): QueueSummary {
  const rows = QUEUE_STATUSES.map(s => ({ status: s.key, label: s.label, total: 0, values: QUEUE_BUCKETS.map(() => 0) }));
  for (const order of orders) {
    const bucket = queueBucket(order, at);
    if (!bucket) continue;
    const row = rows.find(r => r.status === order.status)!;
    row.values[QUEUE_BUCKETS.findIndex(b => b.key === bucket)]++; row.total++;
  }
  return { at, total: rows.reduce((n, row) => n + row.total, 0), rows };
}
export function parseQueueFilter(q: { qStatus?: unknown; qAge?: unknown; qAt?: unknown }) {
  if (q.qStatus === undefined && q.qAge === undefined && q.qAt === undefined) return { filter: null, error: '' };
  if (!QUEUE_STATUSES.some(s => s.key === q.qStatus) || !QUEUE_BUCKETS.some(b => b.key === q.qAge)
    || typeof q.qAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(q.qAt) || !Number.isFinite(timestamp(q.qAt))) {
    return { filter: null, error: '차트 조회 조건을 확인해주세요. 운영 홈의 그래프에서 다시 선택할 수 있습니다.' };
  }
  return { filter: { status: q.qStatus, bucket: q.qAge, at: q.qAt } as QueueFilter, error: '' };
}
export function queueFilterHref(status: QueueStatus, bucket: QueueBucket, at: string) {
  return '/admin/orders?' + new URLSearchParams({ qStatus: status, qAge: bucket, qAt: at });
}
export function matchesQueueFilter(order: QueueOrder, filter: QueueFilter) {
  return order.status === filter.status && queueBucket(order, filter.at) === filter.bucket;
}

export type ProductInsightRow = {
  id: string; name: string; sold: number | null; gross: number | null; net: number | null;
  pending: number; quantityReview: boolean; moneyReview: boolean; options: ProductSales['options']; href: string;
};
export function productInsightRows(products: { id: string; name: string }[], sales: Record<string, ProductSales> | null,
  financials: Record<string, ProductMoney> | null | undefined, from = '', to = ''): ProductInsightRow[] {
  return products.map(product => {
    const counts = sales?.[product.id], money = financials?.[product.id];
    return { ...product, sold: !counts || counts.review > 0 ? null : counts.sold,
      gross: money?.gross ?? null, net: money?.net ?? null, pending: counts?.pending ?? 0,
      quantityReview: !counts || counts.review > 0, moneyReview: !money || money.net === null,
      options: counts?.options ?? [],
      href: '/admin/products/' + encodeURIComponent(product.id) + '/sales?' + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    };
  });
}
export function rankProducts(rows: ProductInsightRow[], metric: 'sold' | 'gross' | 'net') {
  return rows.filter(row => row[metric] !== null && Number.isFinite(row[metric]) && row[metric]! > 0)
    .sort((a, b) => b[metric]! - a[metric]! || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id)).slice(0, 10);
}

export const RETURN_REASONS_CHART = [
  { key: 'change', label: RETURN_REASONS[0] }, { key: 'defect', label: RETURN_REASONS[1] },
  { key: 'wrong', label: RETURN_REASONS[2] }, { key: 'missing', label: RETURN_REASONS[3] },
  { key: 'other', label: '기타·미분류' },
] as const;
export const RETURN_STATES = [
  { key: 'requested', label: '신청 접수' }, { key: 'collecting', label: '수거·처리 중' },
  { key: 'done', label: '완료' }, { key: 'rejected', label: '거절' }, { key: 'unknown', label: '상태 확인' },
] as const;
export type ReturnReasonKey = typeof RETURN_REASONS_CHART[number]['key'];
export type ReturnStateKey = typeof RETURN_STATES[number]['key'];
export type ReturnDuration = typeof AGE_BUCKETS[number]['key'] | 'unknown';
export type ReturnRange = { from: string; to: string; kind: 'all' | 'return' | 'exchange' };
export type ReturnListFilter = ReturnRange & { reason?: ReturnReasonKey; status?: ReturnStateKey; duration?: ReturnDuration };
export type ReturnInsightRecord = { kind: string; reason: string | null; status: string; created_at: string | Date; done_at?: string | Date | null };
export function returnReasonKey(reason: string | null): ReturnReasonKey {
  return RETURN_REASONS_CHART.slice(0, 4).find(r => r.label === reason)?.key ?? 'other';
}
export function returnStateKey(status: string): ReturnStateKey {
  return RETURN_STATES.slice(0, 4).find(s => s.key === status)?.key ?? 'unknown';
}
export function returnDuration(record: ReturnInsightRecord): ReturnDuration {
  return ageBucket((timestamp(record.done_at) - timestamp(record.created_at)) / 3600000);
}
export function readReturnRange(q: { returnsFrom?: unknown; returnsTo?: unknown; returnsKind?: unknown }, now = Date.now()) {
  const today = kstDateKey(now), first = new Date(Date.parse(today + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10);
  const from = q.returnsFrom === undefined ? first : q.returnsFrom, to = q.returnsTo === undefined ? today : q.returnsTo;
  const kind = q.returnsKind === undefined ? 'all' : q.returnsKind;
  if (typeof from !== 'string' || typeof to !== 'string' || (from && !validInsightDate(from)) || (to && !validInsightDate(to))
    || (from && to && from > to) || typeof kind !== 'string' || !['all', 'return', 'exchange'].includes(kind)) {
    return { range: null, error: '신청일 조회 기간과 구분을 확인해주세요.' };
  }
  return { range: { from, to, kind } as ReturnRange, error: '' };
}
export function readReturnListFilter(q: Record<string, unknown>, range: ReturnRange) {
  const reason = q.returnsReason, status = q.returnsStatus, duration = q.returnsDuration;
  if ((reason !== undefined && !RETURN_REASONS_CHART.some(r => r.key === reason))
    || (status !== undefined && !RETURN_STATES.some(s => s.key === status))
    || (duration !== undefined && ![...AGE_BUCKETS.map(b => b.key), 'unknown'].includes(String(duration)))
    || (duration !== undefined && status !== undefined && status !== 'done')) return null;
  return { ...range, ...(reason ? { reason } : {}), ...(status || duration ? { status: duration ? 'done' : status } : {}), ...(duration ? { duration } : {}) } as ReturnListFilter;
}
export function returnInsightHref(range: ReturnRange, patch: Partial<ReturnListFilter> = {}) {
  const filter = { ...range, ...patch };
  return '/admin/shipments?' + new URLSearchParams({ returnsFrom: filter.from, returnsTo: filter.to, returnsKind: filter.kind,
    returnsDrill: '1', ...(filter.reason ? { returnsReason: filter.reason } : {}),
    ...(filter.duration ? { returnsStatus: 'done', returnsDuration: filter.duration } : filter.status ? { returnsStatus: filter.status } : {}),
  }) + '#customer-requests';
}
export function summarizeReturns(records: ReturnInsightRecord[]) {
  const reasons = RETURN_REASONS_CHART.map(r => ({ ...r, count: 0, exchange: 0, returns: 0 }));
  const states = RETURN_STATES.map(s => ({ ...s, count: 0 }));
  const durations = [...AGE_BUCKETS.map(b => ({ key: b.key as ReturnDuration, label: b.label, count: 0 })), { key: 'unknown' as ReturnDuration, label: '완료 시각 미기록', count: 0 }];
  const hours: number[] = [];
  for (const record of records) {
    const reason = reasons.find(r => r.key === returnReasonKey(record.reason))!;
    reason.count++; if (record.kind === 'exchange') reason.exchange++; else reason.returns++;
    states.find(s => s.key === returnStateKey(record.status))!.count++;
    if (record.status === 'done') {
      durations.find(d => d.key === returnDuration(record))!.count++;
      const value = (timestamp(record.done_at) - timestamp(record.created_at)) / 3600000;
      if (Number.isFinite(value) && value >= 0) hours.push(value);
    }
  }
  hours.sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2), medianHours = !hours.length ? null : hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
  return { total: records.length, reasons, states, durations, timedCompletions: hours.length, medianHours };
}
export type ReturnSummary = ReturnType<typeof summarizeReturns>;
