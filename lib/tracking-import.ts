import { CORE_CARRIERS, LEGACY_TEXT_TO_CODE } from '@/lib/carriers';
import { validTrackingNumber } from '@/lib/tracking-validation';

export const IMPORT_POLICY_VERSION = 1;
export type Carrier = { code: string; name: string };
export type ImportRow = {
  order_number: string; tracking_number: string; carrier: string | null;
  carrier_raw: string; source_row: number; source_sheet: string; issue?: string;
};
export type ImportOrder = {
  id: string; order_number: string; status: string; pending_refunds: boolean;
  tracking_company: string | null; tracking_number: string | null;
};
export type ReviewRow = ImportRow & {
  order_id?: string; resolved_order?: string; current_status?: string;
  result: 'ready' | 'already' | 'duplicate' | 'blocked'; reason: string;
};
export type ImportReview = {
  rows: ReviewRow[];
  counts: { total: number; ready: number; already: number; duplicate: number; blocked: number };
};

const carrierKey = (v: string) => v.replace(/\s/g, '').toLowerCase();
export function resolveImportCarrier(raw: string, carriers: Carrier[] = CORE_CARRIERS): string | null {
  const key = carrierKey(raw);
  const alias = LEGACY_TEXT_TO_CODE[key];
  return carriers.find(c => c.code === key || c.code === alias || carrierKey(c.name) === key)?.code ?? null;
}
export const invoiceKey = (v: string) => v.replace(/-/g, '');
export const suffixBase = (v: string) => v.replace(/-[1-9]\d*$/, '');

export function normalizeImportRows(input: unknown, fallback: unknown, carriers: Carrier[]): ImportRow[] {
  if (!Array.isArray(input) || !input.length || input.length > 2000) throw Error('송장 데이터는 1~2,000행으로 입력해주세요.');
  const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
  return input.map((value, index) => {
    const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const order_number = text(row.order_number), tracking_number = text(row.tracking_number);
    const rawValue = row.carrier_raw ?? row.carrier;
    const carrier_raw = text(rawValue);
    const carrier = resolveImportCarrier(carrier_raw || text(fallback), carriers);
    let issue: string | undefined;
    if (!order_number || order_number.length > 150) issue = '주문번호가 없거나 너무 깁니다.';
    else if (!validTrackingNumber(tracking_number)) issue = '운송장번호는 텍스트로 입력한 숫자와 하이픈만 사용할 수 있습니다.';
    else if ((rawValue != null && typeof rawValue !== 'string') || !carrier) issue = '택배사 이름 또는 코드를 확인해주세요. 알 수 없는 택배사는 자동 대체하지 않습니다.';
    return { order_number, tracking_number, carrier, carrier_raw,
      source_row: Number.isSafeInteger(row.source_row) && row.source_row > 0 ? row.source_row : index + 1,
      source_sheet: text(row.source_sheet).slice(0, 100), ...(issue ? { issue } : {}) };
  });
}

export function orderImportState(order: ImportOrder, row: ImportRow, carriers: Carrier[]): Pick<ReviewRow, 'result' | 'reason'> {
  if (order.pending_refunds) return { result: 'blocked', reason: '환불 처리 중입니다. 환불 결과를 먼저 확인해주세요.' };
  const previousCarrier = resolveImportCarrier(order.tracking_company ?? '', carriers);
  const previousNumber = order.tracking_number?.trim() ?? '';
  const same = !!previousCarrier && previousCarrier === row.carrier && validTrackingNumber(previousNumber) && invoiceKey(previousNumber) === invoiceKey(row.tracking_number);
  if (['shipped', 'delivered'].includes(order.status)) {
    if (same) return { result: 'already', reason: '이미 같은 송장이 등록되어 있습니다. 상태·발송일·문자는 변경하지 않습니다.' };
    return { result: 'blocked', reason: !previousCarrier || !previousNumber ? '배송중/완료 주문의 송장 누락은 주문 상세에서 보완해주세요.' : '기존 송장과 다릅니다. 일괄 업로드로 덮어쓸 수 없습니다.' };
  }
  if (order.status !== 'preparing') return { result: 'blocked', reason: ['paid', 'confirmed'].includes(order.status) ? '발주 확정 후 배송준비 상태에서 등록해주세요.' : '취소·반품·교환 등 현재 상태에서는 발송할 수 없습니다.' };
  if ((previousCarrier && previousCarrier !== row.carrier) || (order.tracking_company && !previousCarrier) || (previousNumber && (!validTrackingNumber(previousNumber) || invoiceKey(previousNumber) !== invoiceKey(row.tracking_number))))
    return { result: 'blocked', reason: '배송준비 주문에 저장된 송장과 다릅니다. 주문 상세를 확인해주세요.' };
  return { result: 'ready', reason: '배송중으로 변경하고 발송 안내를 예약합니다.' };
}

export function reviewImport(rows: ImportRow[], orders: ImportOrder[], carriers: Carrier[]): ImportReview {
  const byNumber = new Map(orders.map(o => [o.order_number, o]));
  const reviewed: ReviewRow[] = rows.map(row => ({ ...row, result: 'blocked', reason: row.issue ?? '현재 사이트에서 주문을 찾을 수 없습니다.' }));
  const groups = new Map<string, { order: ImportOrder; indexes: number[] }>();
  rows.forEach((row, index) => {
    let order = byNumber.get(row.order_number);
    // Exact order always wins. A supplier suffix is redundant only with an identical base row in this file.
    if (!order && !row.issue) {
      const base = suffixBase(row.order_number);
      const sameBaseRow = base !== row.order_number && rows.some(r => r.order_number === base && !r.issue && r.carrier === row.carrier && invoiceKey(r.tracking_number) === invoiceKey(row.tracking_number));
      if (sameBaseRow) order = byNumber.get(base);
      if (!order && base !== row.order_number) reviewed[index].reason = '접미 주문번호를 확인해주세요. 원주문과 같은 송장 행이 파일에 있을 때만 중복으로 제외합니다.';
    }
    if (!order) return;
    Object.assign(reviewed[index], { order_id: order.id, resolved_order: order.order_number, current_status: order.status });
    const group = groups.get(order.id) ?? { order, indexes: [] };
    group.indexes.push(index); groups.set(order.id, group);
  });
  for (const { order, indexes } of groups.values()) {
    const keys = new Set(indexes.map(i => `${rows[i].carrier}:${invoiceKey(rows[i].tracking_number)}`));
    if (keys.size !== 1 || indexes.some(i => rows[i].issue)) {
      for (const i of indexes) Object.assign(reviewed[i], { result: 'blocked', reason: '같은 주문에 서로 다른 송장·택배사 또는 오류 행이 있습니다. 해당 주문의 모든 행을 확인해주세요.' });
      continue;
    }
    const primary = indexes.find(i => rows[i].order_number === order.order_number)!;
    Object.assign(reviewed[primary], orderImportState(order, rows[primary], carriers));
    for (const i of indexes.filter(i => i !== primary)) Object.assign(reviewed[i], { result: 'duplicate', reason: `${rows[primary].source_row}행과 같은 주문·송장입니다. 중복 행을 제외합니다.` });
  }
  return summarizeImport(reviewed);
}
export function summarizeImport(rows: ReviewRow[]): ImportReview {
  const counts = { total: rows.length, ready: 0, already: 0, duplicate: 0, blocked: 0 };
  for (const row of rows) counts[row.result]++;
  return { rows, counts };
}
