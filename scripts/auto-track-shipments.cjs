/** Automatic shipment lookup. At most 80 eligible orders per run; completed orders are not queried again. */
require('@next/env').loadEnvConfig(process.cwd(), false);
const {Pool} = require('pg');
const {recordTracking} = require('../lib/shipment-outbox.cjs');
const {recordDeliverySettlement} = require('../lib/delivery-settlement.cjs');
const {beginTrackingRun, finishTrackingRun, fetchTrackingStatus, applyDeliveryResults, safeTrackingText} = require('../lib/shipment-tracking-log.cjs');
const LEGACY = {cj:'04',hanjin:'05',lotte:'08',post:'01',logen:'06'};
const SITES = {blendpick:'블랜드픽',sanjipick:'산지픽'};
const LIMIT = 80;
const kst = value => new Date(value).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hourCycle:'h23'});
function toCode(stored) {
 if (!stored) return null;
 return /^\d{1,3}$/.test(stored) ? stored : LEGACY[stored.toLowerCase()] || null;
}

async function main() {
 if (!process.env.SHOP_DATABASE_URL) throw Error('DATABASE_MISSING');
 const pool = new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false}});
 const runs = new Map();
 const results = [];
 let fatal = null;
 console.log(`[자동 배송조회 시작] ${kst(Date.now())} (한국시간) · 최대 ${LIMIT}건`);
 try {
  for (const site of Object.keys(SITES)) {
   const run = await beginTrackingRun(pool, site, 'automatic');
   if (run) runs.set(site, run);
   else console.log(`[${SITES[site]}] 이미 조회가 진행 중이어서 중복 실행을 건너뜁니다.`);
  }
  if (!runs.size) return;
  const apiKey = process.env.SWEETTRACKER_API_KEY;
  if (!apiKey) { fatal = '배송조회 API 키가 등록되지 않았습니다. 연동 설정을 확인해주세요.'; return; }
  const {rows:orders} = await pool.query(`SELECT id,order_number,COALESCE(site,'blendpick') AS site,tracking_company,tracking_number,total_amount,payment_method,payment_key
   FROM orders WHERE status='shipped' AND tracking_number IS NOT NULL AND COALESCE(site,'blendpick')=ANY($1::text[])
   AND NOT EXISTS(SELECT 1 FROM shipment_tracking_checks c WHERE c.order_id=orders.id AND c.tracking_number=orders.tracking_number AND c.next_attempt_at>NOW())
   ORDER BY tracking_checked_at ASC NULLS FIRST,created_at ASC LIMIT $2`, [[...runs.keys()],LIMIT]);
  const deliveredIds = [];
  for (const order of orders) {
   await pool.query('UPDATE orders SET tracking_checked_at=NOW() WHERE id=$1', [order.id]);
   const code = toCode(order.tracking_company);
   const info = code ? await fetchTrackingStatus(apiKey, order.tracking_number, code)
    : {error:'택배사를 확인할 수 없습니다. 주문의 택배사와 송장을 확인해주세요.',code:'CARRIER_UNKNOWN'};
   if ('error' in info) {
    await recordTracking(pool, order, info.error);
    results.push({site:order.site,order_id:order.id,order_number:order.order_number,outcome:'failed',message:info.error,code:info.code});
   } else {
    await recordTracking(pool, order, null);
    results.push({site:order.site,order_id:order.id,order_number:order.order_number,outcome:info.delivered?'pending_delivery':'in_transit',message:info.statusText});
    if (info.delivered) deliveredIds.push(order.id);
   }
  }
  if (deliveredIds.length) {
   const client = await pool.connect();
   try {
    await client.query('BEGIN');
    const {rows:updated} = await client.query(`UPDATE orders SET status = 'delivered', delivered_at=COALESCE(delivered_at,NOW())
     WHERE id = ANY($1::uuid[]) AND status = 'shipped'
     RETURNING id, order_number, total_amount, payment_method, payment_key`, [deliveredIds]);
    for (const order of updated) await recordDeliverySettlement(client, order);
    await client.query('COMMIT');
    applyDeliveryResults(results, updated.map(order=>order.id));
   } catch (error) {
    await client.query('ROLLBACK');
    const reason = error?.code === 'P2001' ? '환불 처리 중인 주문이 포함되어 배송완료 반영을 보류했습니다. 환불 상태를 확인해주세요.'
     : '배송완료 저장에 실패했습니다. 주문 상태를 확인하고 다시 조회해주세요.';
    applyDeliveryResults(results, [], reason);
   } finally { client.release(); }
  }
 } catch {
  fatal = '배송조회 처리 중 오류가 발생했습니다. 서버 연결과 주문 상태를 확인해주세요.';
 } finally {
  try {
   for (const [site,run] of runs) {
    const rows = results.filter(row=>row.site===site).map(({site,...row})=>row);
    const summary = await finishTrackingRun(pool, run.id, rows, fatal);
    console.log(`::group::${SITES[site]} · 주문별 배송조회 결과`);
    for (const row of rows) console.log(`[${row.outcome==='failed'?'실패':row.outcome==='delivered'?'완료 반영':row.outcome==='skipped'?'건너뜀':'배송중'}] ${safeTrackingText(row.order_number)} · ${safeTrackingText(row.message)}${row.code?` (${safeTrackingText(row.code)})`:''}`);
    if (!rows.length) console.log(summary.message || '이번 실행에서 조회할 대상이 없습니다.');
    console.log('::endgroup::');
    console.log(`[${SITES[site]} 조회 결과] ${kst(summary.started_at)} → ${kst(summary.finished_at)} (한국시간)`);
    console.log(`조회 ${summary.checked}건 | 배송완료 반영 ${summary.delivered}건 | 배송중 ${summary.in_transit}건 | 실패 ${summary.failed}건 | 건너뜀 ${summary.skipped}건`);
    console.log('TRACKING_SUMMARY_JSON:'+JSON.stringify({site:SITES[site],status:summary.status,started_at:summary.started_at,finished_at:summary.finished_at,checked:summary.checked,delivered:summary.delivered,in_transit:summary.in_transit,failed:summary.failed,skipped:summary.skipped}));
    if (summary.failed || fatal) process.exitCode = 1;
   }
  } finally { await pool.end(); }
 }
}

if (require.main === module) main().catch(()=>{console.error('자동 배송조회 실행 실패 · 서버 연결과 조회 이력을 확인해주세요.');process.exitCode=1;});
module.exports = {main};
