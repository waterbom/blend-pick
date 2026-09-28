import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import shopPool from '@/lib/db-shop';
import { shipmentCarriers } from '@/lib/shipment-carriers';
import { IMPORT_POLICY_VERSION, normalizeImportRows, reviewImport, summarizeImport, suffixBase, type ImportRow, type ImportReview } from '@/lib/tracking-import';
import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from '@/lib/refund-fulfillment';
import { enqueue, processQueue } from '@/lib/shipment-outbox.cjs';
import { shipmentSMSText } from '@/lib/ship-notify';
import { smsConfigured, sendSMS } from '@/lib/sms';

export class ShipmentImportError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
type Admin = { id: string; email: string };
type Payload = { version: number; site: string; admin: string; hash: string; ids: string[]; expires: number };
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const adminKey = (admin: Admin) => `${admin.id}:${admin.email}`;
function signature(value: string) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret === 'blend-admin-secret-2026') throw Error('Administrator signing secret is unavailable');
  return createHmac('sha256', secret).update('shipment-import-preview:' + value).digest('base64url');
}
function issueToken(payload: Payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${value}.${signature(value)}`;
}
function verifyToken(token: unknown, site: string, admin: Admin, rows: ImportRow[]): Payload {
  if (typeof token !== 'string' || token.length > 150000) throw new ShipmentImportError('등록 전 미리보기를 실행해주세요.', 400);
  const parts = token.split('.');
  if (parts.length !== 2) throw new ShipmentImportError('미리보기 확인값이 올바르지 않습니다.', 400);
  const expected = Buffer.from(signature(parts[0])), actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ShipmentImportError('미리보기 확인값이 올바르지 않습니다.', 400);
  let p: Payload;
  try { p = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); }
  catch { throw new ShipmentImportError('미리보기 확인값을 읽을 수 없습니다.', 400); }
  if (p.version !== IMPORT_POLICY_VERSION || p.site !== site || p.admin !== adminKey(admin) || p.hash !== hash(rows) || !Array.isArray(p.ids) || !Number.isFinite(p.expires))
    throw new ShipmentImportError('파일·택배사·사이트가 변경되었습니다. 미리보기를 다시 실행해주세요.');
  return p;
}
async function input(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ShipmentImportError('요청 본문을 확인해주세요.', 400);
  const data = body as Record<string, unknown>;
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 2000) throw new ShipmentImportError('송장 데이터는 1~2,000행으로 입력해주세요.', 400);
  const { carriers } = await shipmentCarriers();
  return { data, carriers, rows: normalizeImportRows(data.rows, data.defaultCarrier, carriers) };
}
const orderSQL = `SELECT o.id,o.order_number,o.status,o.tracking_company,o.tracking_number,
  EXISTS(SELECT 1 FROM refund_operations r WHERE r.order_id=o.id AND r.status NOT IN ('completed','rejected')) AS pending_refunds
  FROM orders o WHERE o.site=$1 AND o.order_number=ANY($2::text[])`;
const numbers = (rows: ImportRow[]) => [...new Set(rows.flatMap(r => [r.order_number, suffixBase(r.order_number)]))];

export async function previewShipmentImport(site: string, admin: Admin, body: unknown) {
  const { rows, carriers } = await input(body);
  const orders = await shopPool.query(orderSQL, [site, numbers(rows)]);
  const review = reviewImport(rows, orders.rows, carriers);
  const expires = Date.now() + 15 * 60 * 1000;
  const token = issueToken({ version: IMPORT_POLICY_VERSION, site, admin: adminKey(admin), hash: hash(rows), expires,
    ids: review.rows.filter(r => r.result === 'ready').map(r => r.order_id!) });
  return { ...review, token, expiresAt: new Date(expires).toISOString() };
}

export type ShipmentImportResult = ImportReview & {
  ok: true; succeeded: number; alreadyApplied: number; duplicateExcluded: number; smsQueued: number;
  failed: { order_number: string; source_row: number; reason: string }[];
};
export async function commitShipmentImport(site: string, admin: Admin, body: unknown): Promise<ShipmentImportResult> {
  const { data, rows, carriers } = await input(body);
  if (typeof data.requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.requestKey))
    throw new ShipmentImportError('등록 요청 번호를 확인해주세요.', 400);
  const p = verifyToken(data.token, site, admin, rows);
  const requestHash = hash({ rows, token: data.token });
  const c = await shopPool.connect();
  const notify: string[] = [];
  let result: ShipmentImportResult;
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [site + ':shipment-import:' + data.requestKey]);
    const previous = (await c.query('SELECT input_hash,admin_id,result FROM admin_shipment_import_batches WHERE site=$1 AND request_key=$2', [site, data.requestKey])).rows[0];
    if (previous) {
      if (previous.input_hash !== requestHash || previous.admin_id !== adminKey(admin)) throw new ShipmentImportError('같은 요청 번호로 등록 내용을 바꿀 수 없습니다.');
      await c.query('COMMIT');
      return previous.result;
    }
    if (p.expires < Date.now()) throw new ShipmentImportError('미리보기 유효시간이 지났습니다. 다시 확인해주세요.');
    // All request keys lock orders in the same order. Refund intents use these same locks.
    await c.query('SELECT id FROM orders WHERE site=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [site, [...p.ids].sort()]);
    // A fresh statement sees refund intents committed while the lock was waiting.
    const orders = await c.query(orderSQL, [site, numbers(rows)]);
    const review = reviewImport(rows, orders.rows, carriers);
    const allowed = new Set(p.ids);
    for (const row of review.rows) {
      if (!['ready', 'already'].includes(row.result)) continue;
      if (row.result === 'already') continue;
      if (!row.order_id || !allowed.has(row.order_id)) {
        row.result = 'blocked'; row.reason = '미리보기에서 등록 대상으로 확인되지 않은 주문입니다. 다시 확인해주세요.'; continue;
      }
      await c.query('SAVEPOINT shipment_order');
      try {
        const updated = await c.query(`UPDATE orders SET status='shipped',shipped_at=COALESCE(shipped_at,NOW()),
          tracking_company=$2,tracking_number=$3,updated_at=NOW()
          WHERE order_number=$1 AND site=$4 AND id=$5 AND status='preparing'
          RETURNING COALESCE(recipient_name,buyer_name) AS name`,
        [row.resolved_order, row.carrier, row.tracking_number, site, row.order_id]);
        if (updated.rowCount !== 1) throw new ShipmentImportError('주문 상태가 변경되었습니다. 미리보기를 다시 실행해주세요.');
        await enqueue(c, row.resolved_order, site, row.tracking_number, shipmentSMSText({ buyerName: updated.rows[0].name || '', orderNumber: row.resolved_order!, carrier: row.carrier, trackingNumber: row.tracking_number, site }));
        await c.query('RELEASE SAVEPOINT shipment_order');
        row.current_status = 'shipped';
        notify.push(row.resolved_order!);
      } catch (e) {
        if (!isRefundFulfillmentConflict(e)) throw e;
        await c.query('ROLLBACK TO SAVEPOINT shipment_order');
        await c.query('RELEASE SAVEPOINT shipment_order');
        row.result = 'blocked'; row.reason = REFUND_FULFILLMENT_MESSAGE;
      }
    }
    const final = summarizeImport(review.rows);
    result = { ok: true, ...final, succeeded: notify.length, alreadyApplied: final.counts.already,
      duplicateExcluded: final.counts.duplicate, smsQueued: notify.length,
      failed: final.rows.filter(r => r.result === 'blocked').map(r => ({ order_number: r.order_number, source_row: r.source_row, reason: r.reason })) };
    await c.query(`INSERT INTO admin_shipment_import_batches(site,request_key,admin_id,input_hash,policy_version,result)
      VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [site, data.requestKey, adminKey(admin), requestHash, IMPORT_POLICY_VERSION, JSON.stringify(result)]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK'); throw e;
  } finally { c.release(); }
  // Notification delivery follows the atomic order/outbox/result commit.
  if (smsConfigured()) for (const orderNumber of notify) {
    try { await processQueue(shopPool, sendSMS, { limit: 1, site, orderNumber }); }
    catch { console.error('Shipment notification queue deferred'); }
  }
  return result;
}
