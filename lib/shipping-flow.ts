import { dispatchIssues, orderQueue, type DispatchOrder } from '@/lib/admin-workflow';

export type FlowOrder = DispatchOrder & {
  id: string; tracking_company?: string | null; tracking_number?: string | null;
  created_at: string;
};
export function shippingExceptions(order: FlowOrder, now = Date.now()): string[] {
  const issues = orderQueue(order) === 'check' ? dispatchIssues(order) : [];
  if (order.status === 'shipped' && (!order.tracking_company?.trim() || !order.tracking_number?.trim())) issues.push('송장 정보 누락');
  if (order.pending_refunds && ['preparing', 'shipped'].includes(order.status)) issues.push('환불 처리 중 · 출고 확인 필요');
  if (order.status === 'preparing') {
    const dates = (order.items ?? []).map(i => i.expected_ship_date?.slice(0,10)).filter((d): d is string => !!d);
    const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    if (dates.some(d => d < today)) issues.push('출고 예정일 경과');
    else if (!dates.length) issues.push('출고 예정일 미지정');
  }
  return issues;
}

export type TrackingRow = { order_number: string; tracking_number: string; carrier_raw?: string };
// Supplier sheets may reorder their columns. Retain malformed and duplicate rows for explicit review.
export function trackingRows(grid: string[][]): TrackingRow[] {
  const rows = grid.filter(row => row.some(cell => cell.trim()));
  if (!rows.length) return [];
  const headers = rows[0].map(cell => cell.replace(/[\s_]/g, '').toLowerCase());
  const orderIndex = headers.findIndex(h => ['주문번호','주문코드','ordernumber','orderid'].includes(h));
  const trackingIndex = headers.findIndex(h => ['운송장번호','송장번호','trackingnumber','tracking'].includes(h));
  const carrierIndex = headers.findIndex(h => ['택배사','배송업체','carrier'].includes(h));
  const hasHeader = orderIndex >= 0 || trackingIndex >= 0;
  if (hasHeader && (orderIndex < 0 || trackingIndex < 0)) throw Error('주문번호와 운송장번호 열이 모두 필요합니다.');
  return rows.slice(hasHeader ? 1 : 0).map(row => ({
    order_number: (row[hasHeader ? orderIndex : 0] || '').trim(),
    tracking_number: (row[hasHeader ? trackingIndex : 1] || '').trim(),
    carrier_raw: (row[hasHeader ? carrierIndex : 2] || '').trim() || undefined,
  }));
}
export function trackingRowIssues(rows: TrackingRow[]): string[] {
  const seen = new Set<string>();
  return rows.flatMap((row, index) => {
    const errors: string[] = [];
    if (!row.order_number || !row.tracking_number) errors.push(`${index+1}행: 주문번호 또는 운송장번호 누락`);
    if (row.tracking_number && !/^[0-9-]+$/.test(row.tracking_number)) errors.push(`${index+1}행: 운송장번호 형식 확인 필요`);
    if (seen.has(row.order_number)) errors.push(`${index+1}행: 주문번호 중복 (${row.order_number})`);
    seen.add(row.order_number);
    return errors;
  });
}

// RFC-style CSV quoting: commas/newlines inside quotes and doubled quote escapes.
export function parseTrackingCSV(text: string): TrackingRow[] {
  const grid: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += ch;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (ch !== ',') { grid.push(row); row = []; if(ch === '\r' && input[i+1] === '\n') i++; }
    } else if (ch === '"' && !cell && !closed) quoted = true;
    else {
      if (ch === '"' || (closed && ch.trim())) throw Error('CSV 인용부호 형식을 확인해주세요.');
      if (!closed) cell += ch;
    }
  }
  if (quoted) throw Error('CSV 인용부호가 닫히지 않았습니다.');
  row.push(cell); grid.push(row);
  return trackingRows(grid);
}
