import {randomUUID} from 'node:crypto';
import {ApiError,readJsonObject,rollbackSafely,withApiErrors} from '@/lib/api-errors';
import {adminAccess,inputText,isUuid} from '@/lib/customer-access';
import pool from '@/lib/db-shop';
import {enqueue,origin} from '@/lib/customer-notifications.cjs';
import {configuration} from '@/lib/commerce-provider.cjs';
export const GET=withApiErrors('GET /api/admin/customer-care',async()=>{
 const site=await adminAccess();
 const [questions,notifications,late]=await Promise.all([
  pool.query(`SELECT q.*,o.order_number,p.name product_name FROM customer_questions q LEFT JOIN orders o ON o.id=q.order_id LEFT JOIN products_shop p ON p.id=q.product_id WHERE q.site=$1 ORDER BY (q.reply IS NULL) DESC,q.created_at DESC LIMIT 100`,[site]),
  pool.query('SELECT n.id,n.kind,n.title,n.status,n.last_error,n.provider_id,n.created_at,o.order_number FROM customer_notifications n LEFT JOIN orders o ON o.id=n.order_id WHERE n.site=$1 ORDER BY n.created_at DESC LIMIT 100',[site]),
  pool.query(`SELECT o.id,o.order_number,to_char(p.expected_date,'YYYY-MM-DD') expected_date,p.reason FROM orders o JOIN order_shipping_promises p ON p.order_id=o.id
    WHERE o.site=$1 AND o.status IN ('paid','confirmed','preparing') AND p.expected_date<(now() AT TIME ZONE 'Asia/Seoul')::date ORDER BY p.expected_date LIMIT 100`,[site])]);
 return Response.json({questions:questions.rows,notifications:notifications.rows,late:late.rows,channels:configuration(site)},{headers:{'Cache-Control':'no-store'}});
});
export const POST=withApiErrors('POST /api/admin/customer-care',async(req:Request)=>{
 const site=await adminAccess(req);const b=await readJsonObject(req);
 if(!isUuid(b.id))throw new ApiError('INVALID_INPUT');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  if(b.action==='reply'){
   const reply=inputText(b.reply,3000);
   const r=await db.query('SELECT * FROM customer_questions WHERE id=$1 AND site=$2 FOR UPDATE',[b.id,site]);const q=r.rows[0];if(!q)throw new ApiError('NOT_FOUND');
   await db.query('UPDATE customer_questions SET reply=$3,replied_at=now(),is_public=$4 WHERE id=$1 AND site=$2',[b.id,site,reply,b.publish===true&&q.public_requested&&!q.order_id]);
   if(q.user_id)await enqueue(db,{site,key:'answer:'+q.id,kind:'answer',userId:q.user_id,title:'문의 답변이 등록되었습니다',body:'문의 내역에서 판매자의 답변을 확인해주세요.',href:'/support'});
  }else if(b.action==='shipping-date'){
   const date=inputText(b.date,10),reason=inputText(b.reason,300);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<new Date(Date.now()+9*3600000).toISOString().slice(0,10))throw new ApiError('INVALID_INPUT','오늘 이후의 유효한 출고일을 입력해주세요.');
   const result=await db.query("SELECT id,user_id,buyer_phone,order_number FROM orders WHERE id=$1 AND site=$2 AND status IN ('paid','confirmed','preparing') FOR UPDATE",[b.id,site]);const o=result.rows[0];if(!o)throw new ApiError('STATE_CONFLICT');
   const prior=await db.query("SELECT to_char(expected_date,'YYYY-MM-DD') date,reason FROM order_shipping_promises WHERE order_id=$1",[o.id]);
   if(prior.rows[0]?.date!==date||prior.rows[0]?.reason!==reason){
    const saved=await db.query(`INSERT INTO order_shipping_promises(order_id,expected_date,reason) VALUES($1,$2,$3)
     ON CONFLICT(order_id) DO UPDATE SET expected_date=$2,reason=$3,revision=order_shipping_promises.revision+1,updated_at=now() RETURNING revision`,[o.id,date,reason]);
    await enqueue(db,{site,key:`delay:${o.id}:${saved.rows[0].revision}`,kind:'delay',orderId:o.id,userId:o.user_id,phone:String(o.buyer_phone||'').replace(/\D/g,''),title:'출고 일정 안내',href:'/orders/lookup',
     body:`주문번호: ${o.order_number}\n변경 출고일: ${date}\n변경 사유: ${reason}\n주문 확인: ${origin(site)}/orders/lookup`,variables:{'#{주문번호}':o.order_number,'#{출고예정일}':date,'#{안내사유}':reason,'#{주문조회URL}':origin(site)+'/orders/lookup'}});
   }
  }else if(b.action==='release-blocked'){
   const n=(await db.query("SELECT kind FROM customer_notifications WHERE id=$1 AND site=$2 AND status='blocked' FOR UPDATE",[b.id,site])).rows[0];
   if(!n||!configuration(site)[n.kind])throw new ApiError('STATE_CONFLICT','발송 채널과 승인 템플릿을 먼저 설정해주세요.');
   const resumed=await db.query("UPDATE customer_notifications SET status='pending',last_error=NULL,updated_at=now() WHERE id=$1 AND site=$2 AND created_at>now()-INTERVAL '24 hours' RETURNING id",[b.id,site]);
   if(!resumed.rowCount)throw new ApiError('STATE_CONFLICT','발송 재개 가능 시간이 지났습니다. 사이트 알림에서 확인할 수 있습니다.');
  }else if(b.action==='resolve'){
   if(b.confirmed!==true||!['delivered','cancelled'].includes(b.status))throw new ApiError('INVALID_INPUT');
   const r=await db.query("UPDATE customer_notifications SET status=$3,last_error='관리자 공급자 이력 대조 완료',updated_at=now() WHERE id=$1 AND site=$2 AND status IN ('review','accepted') RETURNING id",[b.id,site,b.status]);
   if(!r.rowCount)throw new ApiError('STATE_CONFLICT');
  }else throw new ApiError('INVALID_INPUT');
  await db.query('COMMIT');return Response.json({ok:true});
 }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
