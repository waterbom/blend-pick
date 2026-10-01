const {randomUUID} = require('node:crypto');
const provider = require('./commerce-provider.cjs');
const CATS = ['산지픽','산지픽 농산물','산지픽 해산물'];
function brand(site) { return site === 'sanjipick' ? '산지픽' : '블랜드픽'; }
function origin(site) { return site === 'sanjipick' ? 'https://sanjipick.blendpunch.com' : 'https://shop.blendpunch.com'; }
async function enqueue(db, job) {
  return db.query(`INSERT INTO customer_notifications(id,site,event_key,kind,user_id,order_id,interest_id,phone,title,body,href,variables,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) ON CONFLICT(site,event_key) DO NOTHING`,
    [randomUUID(),job.site,job.key,job.kind,job.userId||null,job.orderId||null,job.interestId||null,job.phone||null,
      job.title,job.body,job.href,JSON.stringify(job.variables||{}),job.phone?'pending':'site_only']);
}
async function discoverOrders(db) {
  const orders = await db.query(`SELECT o.id,o.site,o.user_id,o.order_number,o.total_amount,o.buyer_phone,
    (SELECT string_agg(DISTINCT to_jsonb(p)->>'expected_ship_date',', ') FROM order_items i JOIN products_shop p ON p.id=i.product_id WHERE i.order_id=o.id) expected_date
    FROM orders o WHERE o.order_type IN ('shop','campaign') AND o.status IN ('paid','confirmed','preparing','shipped','delivered')
    AND o.paid_at >= (SELECT started_at FROM commerce_feature_state WHERE key='customer-notifications')
    AND o.paid_at > now()-INTERVAL '24 hours' AND COALESCE(o.payment_key,'')<>'' AND o.payment_key NOT LIKE 'SIM_%'
    AND NOT EXISTS(SELECT 1 FROM customer_notifications n WHERE n.site=o.site AND n.event_key='paid:'||o.id::text)
    ORDER BY o.paid_at LIMIT 200`);
  for (const o of orders.rows) {
    const href='/orders/lookup',date=o.expected_date||'주문 내역에서 확인';
    await enqueue(db,{site:o.site,key:'paid:'+o.id,kind:'paid',userId:o.user_id,orderId:o.id,phone:normalizePhone(o.buyer_phone),
      title:'주문 접수',href,body:`[${brand(o.site)}] 주문이 접수되었습니다.\n주문번호: ${o.order_number}\n결제금액: ${o.total_amount}원\n출고예정일: ${date}\n주문 확인: ${origin(o.site)+href}`,
      variables:{'#{주문번호}':o.order_number,'#{결제금액}':String(o.total_amount),'#{출고예정일}':date,'#{주문조회URL}':origin(o.site)+href}});
  }
  // Return-completion already has its own customer SMS. Never send a second notice.
  const refunds=await db.query(`SELECT r.source_key,r.actual_amount,o.id,o.user_id,o.site,o.order_number,o.buyer_phone FROM refund_operations r JOIN orders o ON o.id=r.order_id
    WHERE r.status='completed' AND r.actual_amount>0 AND r.source_key NOT LIKE 'return:%' AND o.order_type IN ('shop','campaign')
    AND r.updated_at >= (SELECT started_at FROM commerce_feature_state WHERE key='customer-notifications') AND r.updated_at>now()-INTERVAL '24 hours'
    AND NOT EXISTS(SELECT 1 FROM customer_notifications n WHERE n.site=o.site AND n.event_key='refund:'||r.source_key) ORDER BY r.updated_at LIMIT 200`);
  for(const o of refunds.rows) await enqueue(db,{site:o.site,key:'refund:'+o.source_key,kind:'refund',userId:o.user_id,orderId:o.id,phone:normalizePhone(o.buyer_phone),title:'환불 처리 완료',href:'/orders/lookup',
    body:`[${brand(o.site)}] 환불 처리가 완료되었습니다.\n주문번호: ${o.order_number}\n환불금액: ${o.actual_amount}원\n결제수단에 따라 입금까지 시간이 걸릴 수 있습니다.\n처리 내역: ${origin(o.site)}/orders/lookup`,
    variables:{'#{주문번호}':o.order_number,'#{환불금액}':String(o.actual_amount),'#{주문조회URL}':origin(o.site)+'/orders/lookup'}});
}
function normalizePhone(value) { return String(value||'').replace(/\D/g,''); }
async function discoverInterests(pool) {
  await pool.query(`UPDATE customer_interests SET status='expired',phone=NULL,updated_at=now() WHERE kind<>'wish' AND status='active' AND expires_at<=now()`);
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const interests=await db.query(`SELECT s.*,p.name,po.value AS option_label FROM customer_interests s JOIN products_shop p ON p.id=s.product_id
      LEFT JOIN product_options po ON po.id::text=s.option_id AND po.product_id=p.id AND po.removed_at IS NULL
      WHERE s.kind IN ('restock','opening') AND s.status='active' AND s.expires_at>now() AND p.is_visible=true AND p.status='active'
      AND to_jsonb(p)->>'archived_at' IS NULL
      AND CASE WHEN s.site='sanjipick' THEN p.category=ANY($1::text[]) ELSE NOT COALESCE(p.category=ANY($1::text[]),false) END
      AND (p.sale_start_at IS NULL OR p.sale_start_at<=now()) AND (p.sale_end_at IS NULL OR p.sale_end_at>now())
      AND p.stock<>0 AND (s.option_id='' OR (po.is_active=true AND po.stock<>0))
      AND (s.option_id<>'' OR NOT EXISTS(SELECT 1 FROM product_options x WHERE x.product_id=p.id AND x.removed_at IS NULL)
        OR EXISTS(SELECT 1 FROM product_options x WHERE x.product_id=p.id AND x.removed_at IS NULL AND x.is_active=true AND x.stock<>0))
      ORDER BY s.created_at FOR UPDATE OF s SKIP LOCKED LIMIT 200`,[CATS]);
    for(const s of interests.rows) {
      const href=(s.site==='sanjipick'?'/p/':'/products/')+s.product_id;
      const title=s.kind==='opening'?'신청한 공구가 열렸어요':'신청한 상품이 재입고되었어요';
      const name=s.name+(s.option_label?' · '+s.option_label:'');
      await enqueue(db,{site:s.site,key:'interest:'+s.id+':'+new Date(s.created_at).toISOString(),kind:s.kind,userId:s.user_id,interestId:s.id,phone:s.phone,title,href,
        body:`[${brand(s.site)}] ${title}\n상품: ${name}\n상품 보기: ${origin(s.site)+href}\n알림 신청은 재고 확보를 보장하지 않습니다.`,
        variables:{'#{상품명}':name,'#{상품URL}':origin(s.site)+href}});
      await db.query("UPDATE customer_interests SET status='notified',updated_at=now() WHERE id=$1",[s.id]);
    }
    await db.query('COMMIT');
  } catch(error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
}
async function processQueue(pool, transport=provider, limit=30) {
  const counts={accepted:0,delivered:0,review:0,blocked:0};
  await pool.query("UPDATE customer_notifications SET status='review',last_error='SEND_RESULT_UNKNOWN',updated_at=now() WHERE status='sending' AND updated_at<now()-INTERVAL '5 minutes'");
  // Suppress obsolete paid/restock notices instead of sending stale promises.
  await pool.query(`UPDATE customer_notifications n SET status='cancelled',phone=NULL,last_error='EVENT_NO_LONGER_CURRENT',updated_at=now()
    WHERE n.status IN ('pending','blocked') AND (
      (n.kind='paid' AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=n.order_id AND o.site=n.site AND o.status IN ('paid','confirmed','preparing','shipped','delivered'))) OR
      (n.kind='delay' AND NOT EXISTS(SELECT 1 FROM orders o JOIN order_shipping_promises sp ON sp.order_id=o.id
        WHERE o.id=n.order_id AND o.site=n.site AND o.status IN ('paid','confirmed','preparing')
        AND n.event_key='delay:'||o.id::text||':'||sp.revision::text)) OR
      (n.interest_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_interests s JOIN products_shop p ON p.id=s.product_id
        WHERE s.id=n.interest_id AND s.status='notified' AND p.is_visible=true AND p.status='active' AND p.stock<>0
        AND to_jsonb(p)->>'archived_at' IS NULL AND s.site=n.site
        AND CASE WHEN s.site='sanjipick' THEN p.category=ANY($1::text[]) ELSE NOT COALESCE(p.category=ANY($1::text[]),false) END
        AND (p.sale_start_at IS NULL OR p.sale_start_at<=now()) AND (p.sale_end_at IS NULL OR p.sale_end_at>now())
        AND (s.option_id='' OR EXISTS(SELECT 1 FROM product_options po WHERE po.id::text=s.option_id AND po.product_id=p.id AND po.is_active AND po.stock<>0 AND po.removed_at IS NULL))
        AND (s.option_id<>'' OR NOT EXISTS(SELECT 1 FROM product_options x WHERE x.product_id=p.id AND x.removed_at IS NULL)
          OR EXISTS(SELECT 1 FROM product_options x WHERE x.product_id=p.id AND x.removed_at IS NULL AND x.is_active=true AND x.stock<>0)))))`,[CATS]);
  // An expired external-send window must not erase a valid site inbox notice.
  await pool.query("UPDATE customer_notifications SET status='site_only',phone=NULL,last_error='EXTERNAL_SEND_WINDOW_EXPIRED',updated_at=now() WHERE status IN ('pending','blocked') AND created_at<now()-INTERVAL '24 hours'");
  const accepted=await pool.query("SELECT id,provider_id FROM customer_notifications WHERE status='accepted' ORDER BY updated_at LIMIT $1",[limit]);
  for(const n of accepted.rows) {
    const result=await transport.receipt(n.provider_id);
    await pool.query('UPDATE customer_notifications SET status=$2,last_error=$3,updated_at=now() WHERE id=$1 AND status=\'accepted\'',[n.id,result.status,result.error||null]);
    if(result.status==='delivered') counts.delivered++;
    if(result.status==='review') counts.review++;
  }
  for(let i=0;i<limit;i++) {
    const claim=await pool.query(`UPDATE customer_notifications n SET status='sending',attempts=attempts+1,updated_at=now()
      WHERE id=(SELECT id FROM customer_notifications WHERE status='pending' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
    const n=claim.rows[0];if(!n) break;
    let result;try {result=await transport.sendNotice(n);} catch {result={status:'review',error:'SEND_RESULT_UNKNOWN'};}
    await pool.query(`UPDATE customer_notifications SET status=$2,provider_id=$3,last_error=$4,updated_at=now() WHERE id=$1 AND status='sending'`,[n.id,result.status,result.providerId||null,result.error||null]);
    if(Object.hasOwn(counts,result.status)) counts[result.status]++;
  }
  await pool.query("UPDATE customer_interests SET phone=NULL WHERE phone IS NOT NULL AND (status IN ('cancelled','expired') OR updated_at<now()-INTERVAL '90 days')");
  // Delivery destinations are not needed after the retention window.
  await pool.query("UPDATE customer_notifications SET phone=NULL WHERE phone IS NOT NULL AND created_at<now()-INTERVAL '90 days'");
  await pool.query("DELETE FROM customer_questions WHERE created_at<now()-INTERVAL '3 years'");
  return counts;
}
module.exports={enqueue,discoverOrders,discoverInterests,processQueue,normalizePhone,origin,brand};
