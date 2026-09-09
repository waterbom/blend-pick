// Claim before sending. Ambiguous outcomes are held for human review, never blindly resent.
async function enqueue(db, orderNumber, site, tracking, body) {
 await db.query(`INSERT INTO shipment_notifications(order_id,site,tracking_number,body)
 SELECT id,site,tracking_number,$4 FROM orders WHERE order_number=$1 AND site=$2 AND status='shipped' AND tracking_number=$3
 ON CONFLICT(order_id) DO UPDATE SET tracking_number=EXCLUDED.tracking_number,body=EXCLUDED.body,updated_at=NOW()
 WHERE shipment_notifications.status IN ('pending','retry')`,[orderNumber,site,tracking,body]);
}
/** @param {any} pool @param {Function} send @param {{limit?:number,site?:string|null,orderNumber?:string|null}} options */
async function processQueue(pool, send, {limit=20,site=null,orderNumber=null}={}) {
 const counts={sent:0,failed:0,review:0};
 await pool.query(`UPDATE shipment_notifications SET status='review',last_error='발송 결과 확인 필요',updated_at=NOW()
 WHERE status='sending' AND updated_at < NOW()-INTERVAL '5 minutes' AND ($1::text IS NULL OR site=$1)`,[site]);
 for(let i=0;i<limit;i++) {
  const {rows}=await pool.query(`UPDATE shipment_notifications n SET status='sending',attempts=n.attempts+1,updated_at=NOW()
   WHERE n.id=(SELECT q.id FROM shipment_notifications q JOIN orders o ON o.id=q.order_id
    WHERE q.status IN ('pending','retry') AND q.attempts<5 AND q.next_attempt_at<=NOW()
    AND ($1::text IS NULL OR q.site=$1) AND ($2::text IS NULL OR o.order_number=$2)
    ORDER BY q.next_attempt_at,q.id FOR UPDATE OF q SKIP LOCKED LIMIT 1)
   RETURNING n.*`,[site,orderNumber]);
  const job=rows[0];if(!job)break;
  const {rows:orders}=await pool.query(`SELECT status,tracking_number,COALESCE(recipient_phone,buyer_phone) AS phone FROM orders WHERE id=$1 AND site=$2`,[job.order_id,job.site]);
  const o=orders[0];
  if(!o || !['shipped','delivered'].includes(o.status) || o.tracking_number!==job.tracking_number){
   await pool.query("UPDATE shipment_notifications SET status='cancelled',body='',last_error='주문 상태 또는 송장 변경',updated_at=NOW() WHERE id=$1",[job.id]);continue;
  }
  let result;try {result=await send(o.phone||'',job.body,'상품 발송 안내');}catch{result={ok:false,outcome:'unknown'};}
  const status=result.ok?'sent':result.outcome==='rejected' && job.attempts<5?'retry':'review';
  // Never persist provider messages which can contain recipient data or secrets.
  const reason=result.ok?null:status==='retry'?'발송 거절 · 자동 재시도 대기':'발송 결과 또는 설정 확인 필요';
  await pool.query(`UPDATE shipment_notifications SET status=$2,last_error=$3,body=CASE WHEN $2='sent' THEN '' ELSE body END,
   next_attempt_at=NOW()+($4::int * INTERVAL '15 minutes'),updated_at=NOW() WHERE id=$1`,[job.id,status,reason,Math.min(16,2**(job.attempts-1))]);
  if(result.ok)counts.sent++;else{counts.failed++;if(status==='review')counts.review++;}
 }
 return counts;
}
async function recordTracking(db, order, error) {
 await db.query(`INSERT INTO shipment_tracking_checks(order_id,tracking_number,failures,error,next_attempt_at)
 VALUES($1,$2,CASE WHEN $3::text IS NULL THEN 0 ELSE 1 END,$3,NOW()+INTERVAL '12 hours')
 ON CONFLICT(order_id) DO UPDATE SET tracking_number=EXCLUDED.tracking_number,checked_at=NOW(),
 failures=CASE WHEN $3::text IS NULL THEN 0 WHEN shipment_tracking_checks.tracking_number=$2 THEN shipment_tracking_checks.failures+1 ELSE 1 END,
 error=$3,next_attempt_at=NOW()+INTERVAL '12 hours'`,[order.id,order.tracking_number,error]);
}
module.exports={enqueue,processQueue,recordTracking};
