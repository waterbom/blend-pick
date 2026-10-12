/** Only provider status/error text is accepted; never store a response body or request URL. */
function safeTrackingText(value, secrets = []) {
 let text = String(value || '').replace(/[\r\n\t\x00-\x1f]/g, ' ');
 for (const secret of secrets) if (secret) text = text.split(String(secret)).join('[숨김]');
 return text.replace(/https?:\/\/\S+/gi, '[주소 숨김]').slice(0, 200);
}

async function fetchTrackingStatus(apiKey, trackingNumber, carrierCode) {
 const clean = value => safeTrackingText(value, [apiKey, trackingNumber]);
 try {
  const url = new URL('https://info.sweettracker.co.kr/api/v1/trackingInfo');
  url.searchParams.set('t_key', apiKey);
  url.searchParams.set('t_code', carrierCode);
  url.searchParams.set('t_invoice', trackingNumber);
  const response = await fetch(url.toString(), {cache:'no-store', signal:AbortSignal.timeout(15000)});
  if (!response.ok) {
   const reason = response.status === 401 || response.status === 403 ? 'API 인증에 실패했습니다. 등록한 키와 이용권을 확인해주세요.'
    : response.status === 429 ? '조회 요청 한도를 초과했습니다. 이용량을 확인하고 잠시 후 다시 조회해주세요.'
    : '배송조회 서비스가 응답하지 않았습니다. 잠시 후 다시 조회해주세요.';
   return {error:reason, code:`HTTP_${response.status}`};
  }
  const data = await response.json();
  if (!data || data.status === false) return {error:clean(data?.msg || '배송정보를 조회하지 못했습니다.'), code:clean(data?.code || 'PROVIDER_ERROR')};
  const level = Number(data.lastStateDetail?.level ?? data.level);
  if (!Number.isFinite(level) || level < 1 || level > 6) return {error:'택배사 배송상태를 확인할 수 없습니다. 송장 등록 후 다시 조회해주세요.', code:'STATUS_UNAVAILABLE'};
  return {delivered:level === 6, statusText:clean(data.lastStateDetail?.text || (level === 6 ? '배송완료' : '배송중'))};
 } catch (error) {
  const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
  return {error:timeout ? '배송조회 응답 시간이 초과되었습니다. 잠시 후 다시 조회해주세요.' : '배송조회 서비스 연결에 실패했습니다. 잠시 후 다시 조회해주세요.', code:timeout ? 'TIMEOUT' : 'CONNECTION_ERROR'};
 }
}

async function beginTrackingRun(db, site, source) {
 // The longest supported lookup is 100 × 15 seconds. Recover an abandoned run after 30 minutes.
 await db.query(`UPDATE shipment_tracking_runs SET status='failed',finished_at=NOW(),
  message='실행이 중단되었거나 제한 시간을 넘었습니다. 조회를 다시 실행해주세요.'
  WHERE site=$1 AND status='running' AND started_at<NOW()-INTERVAL '30 minutes'`, [site]);
 const {rows} = await db.query(`INSERT INTO shipment_tracking_runs(site,source) VALUES($1,$2)
  ON CONFLICT(site) WHERE status='running' DO NOTHING RETURNING *`, [site, source]);
 return rows[0] || null;
}

/** @param {any[]} results @param {string[]} committedIds @param {string|null} [errorMessage] */
function applyDeliveryResults(results, committedIds, errorMessage = null) {
 const committed = new Set(committedIds);
 for (const row of results) {
  if (row.outcome !== 'pending_delivery') continue;
  row.outcome = errorMessage ? 'failed' : committed.has(row.order_id) ? 'delivered' : 'skipped';
  row.message = errorMessage || (row.outcome === 'delivered' ? '배송완료 확인 · 주문 반영 완료' : '주문 상태가 변경되어 배송완료 반영을 건너뛰었습니다.');
  if (errorMessage) row.code = 'DELIVERY_SAVE_FAILED';
 }
}

/** @param {any[]} results @param {string|null} [error] */
function summarizeTracking(results, error = null) {
 const counts = {checked:0, delivered:0, in_transit:0, failed:0, skipped:0};
 for (const row of results) {
  counts.checked++;
  if (row.outcome === 'skipped') { counts.skipped++; continue; }
  if (row.outcome === 'delivered') counts.delivered++;
  else if (row.outcome === 'in_transit') counts.in_transit++;
  else counts.failed++;
 }
 const status = error || counts.failed ? (counts.delivered || counts.in_transit ? 'partial' : 'failed') : results.length ? 'success' : 'empty';
 return {...counts, status};
}

/** @param {any} db @param {string} id @param {any[]} results @param {string|null} [error] */
async function finishTrackingRun(db, id, results, error = null) {
 // A candidate is never reported as delivered until the delivery transaction commits.
 for (const row of results) if (row.outcome === 'pending_delivery') {
  row.outcome = 'failed'; row.message = '배송완료 반영 결과를 확인하지 못했습니다. 다시 조회해주세요.'; row.code = 'DELIVERY_UNCONFIRMED';
 }
 const summary = summarizeTracking(results, error);
 const message = error || (summary.status === 'empty' ? '이번 실행에서 조회할 대상이 없습니다.' : null);
 const {rows} = await db.query(`UPDATE shipment_tracking_runs SET status=$2,finished_at=NOW(),checked=$3,
  delivered=$4,in_transit=$5,failed=$6,skipped=$7,message=$8,results=$9::jsonb
  WHERE id=$1 AND status='running' RETURNING *`,
  [id, summary.status, summary.checked, summary.delivered, summary.in_transit, summary.failed, summary.skipped, message, JSON.stringify(results)]);
 if (!rows[0]) throw Error('Tracking run was already closed');
 return rows[0];
}

module.exports = {safeTrackingText, fetchTrackingStatus, beginTrackingRun, applyDeliveryResults, summarizeTracking, finishTrackingRun};
