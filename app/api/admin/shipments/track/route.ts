import { recordTracking } from '@/lib/shipment-outbox.cjs';
import { beginTrackingRun, finishTrackingRun, fetchTrackingStatus, applyDeliveryResults } from '@/lib/shipment-tracking-log.cjs';
import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from '@/lib/refund-fulfillment';
import { currentAdminSite } from '@/lib/admin-site';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import shopPool from '@/lib/db-shop';
import { toCarrierCode } from '@/lib/carriers';
import { recordDeliverySettlement } from '@/lib/delivery-settlement.cjs';

async function getAdmin() {
 const token = (await cookies()).get('admin_token')?.value;
 return token ? verifyAdminToken(token) : null;
}

export async function GET(request: Request) {
 if (!await getAdmin()) return NextResponse.json({error:'Unauthorized'}, {status:401});
 const site = (await currentAdminSite()).key;
 const id = new URL(request.url).searchParams.get('run');
 if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  return NextResponse.json({error:'조회 이력 번호가 올바르지 않습니다.'}, {status:400});
 }
 try {
  const {rows} = await shopPool.query(`SELECT id,site,source,
   CASE WHEN status='running' AND started_at<NOW()-INTERVAL '30 minutes' THEN 'failed' ELSE status END AS status,
   started_at,finished_at,checked,delivered,in_transit,failed,skipped,
   CASE WHEN status='running' AND started_at<NOW()-INTERVAL '30 minutes'
    THEN '실행이 중단되었거나 제한 시간을 넘었습니다. 조회를 다시 실행해주세요.' ELSE message END AS message
   ${id ? ',results' : ''}
   FROM shipment_tracking_runs WHERE site=$1 ${id ? 'AND id=$2::uuid' : ''}
   ORDER BY started_at DESC LIMIT 10`, id ? [site,id] : [site]);
  if (id && !rows.length) return NextResponse.json({error:'조회 이력을 찾을 수 없습니다.'}, {status:404});
  return NextResponse.json(id ? {run:rows[0]} : {runs:rows,keyConfigured:!!process.env.SWEETTRACKER_API_KEY}, {headers:{'Cache-Control':'no-store'}});
 } catch {
  return NextResponse.json({error:'배송조회 이력을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.'}, {status:503});
 }
}

type TrackingRow = {order_id:string; order_number:string; outcome:string; message:string; code?:string};

// Lookup only the current site's shipped orders. Existing delivery/settlement guards still apply.
export async function POST() {
 if (!await getAdmin()) return NextResponse.json({error:'Unauthorized'}, {status:401});
 const site = (await currentAdminSite()).key;
 let run: {id:string} | null = null;
 const results: TrackingRow[] = [];
 let writeFailed = false;
 try {
  run = await beginTrackingRun(shopPool, site, 'manual');
  if (!run) return NextResponse.json({error:'이미 배송조회가 진행 중입니다. 아래 조회 이력에서 결과를 확인해주세요.'}, {status:409});
  const apiKey = process.env.SWEETTRACKER_API_KEY;
  if (!apiKey) {
   await finishTrackingRun(shopPool, run.id, results, '배송조회 API 키가 등록되지 않았습니다. 연동 설정을 확인해주세요.');
   return NextResponse.json({error:'배송조회 API 키가 등록되지 않았습니다. 연동 설정을 확인해주세요.'}, {status:400});
  }
  const {rows:orders} = await shopPool.query(`SELECT id,order_number,tracking_company,tracking_number,total_amount,payment_method,payment_key
   FROM orders WHERE site=$1 AND status='shipped' AND tracking_number IS NOT NULL
   ORDER BY tracking_checked_at ASC NULLS FIRST,created_at ASC LIMIT 100`, [site]);
  const deliveredIds: string[] = [];
  let firstError: string | null = null;
  for (const order of orders) {
   await shopPool.query('UPDATE orders SET tracking_checked_at=NOW() WHERE id=$1 AND site=$2', [order.id,site]);
   const code = toCarrierCode(order.tracking_company);
   const info = code ? await fetchTrackingStatus(apiKey, order.tracking_number, code)
    : {error:'택배사를 확인할 수 없습니다. 주문의 택배사와 송장을 확인해주세요.', code:'CARRIER_UNKNOWN'};
   if ('error' in info) {
    const message = info.error || '배송정보를 조회하지 못했습니다.';
    await recordTracking(shopPool, order, message);
    firstError ??= message;
    results.push({order_id:order.id,order_number:order.order_number,outcome:'failed',message,code:info.code});
   } else {
    await recordTracking(shopPool, order, null);
    results.push({order_id:order.id,order_number:order.order_number,outcome:info.delivered?'pending_delivery':'in_transit',message:info.statusText || '배송중'});
    if (info.delivered) deliveredIds.push(order.id);
   }
  }
  if (deliveredIds.length) {
   const client = await shopPool.connect();
   try {
    await client.query('BEGIN');
    const {rows:updated} = await client.query(`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
     WHERE id = ANY($1::uuid[]) AND site = $2 AND status = 'shipped'
     RETURNING id, order_number, total_amount, payment_method, payment_key`, [deliveredIds,site]);
    for (const order of updated) await recordDeliverySettlement(client, order);
    await client.query('COMMIT');
    applyDeliveryResults(results, updated.map(order=>order.id));
   } catch (error) {
    await client.query('ROLLBACK');
    writeFailed = true;
    applyDeliveryResults(results, [], isRefundFulfillmentConflict(error) ? REFUND_FULFILLMENT_MESSAGE : '배송완료 저장에 실패했습니다. 주문 상태를 확인하고 다시 조회해주세요.');
   } finally { client.release(); }
  }
  const finished = await finishTrackingRun(shopPool, run.id, results);
  return NextResponse.json({ok:finished.failed===0,checked:finished.checked,delivered:finished.delivered,
   in_transit:finished.in_transit,failed:finished.failed,skipped:finished.skipped,writeFailed,
   apiError:finished.checked>0 && finished.failed===finished.checked ? firstError : null,
   run:finished,results:results.map(row=>({...row,status:row.message}))}, {status:writeFailed?503:200});
 } catch {
  const error = '배송조회 처리 중 오류가 발생했습니다. 아래 이력을 확인하고 다시 조회해주세요.';
  if (run) {
   try { await finishTrackingRun(shopPool, run.id, results, error); } catch { /* An interrupted run remains visible and expires after 30 minutes. */ }
  }
  return NextResponse.json({error,writeFailed:true}, {status:503});
 }
}
