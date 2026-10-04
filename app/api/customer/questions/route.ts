import {randomUUID} from 'node:crypto';
import {ApiError,readJsonObject,rollbackSafely,withApiErrors} from '@/lib/api-errors';
import {customerAccess,inputText,isUuid,ownedOrder,publicProduct,sameOrigin} from '@/lib/customer-access';
import {currentSite} from '@/lib/site-server';
import pool from '@/lib/db-shop';
export const GET=withApiErrors('GET /api/customer/questions',async(req:Request)=>{
 const product=new URL(req.url).searchParams.get('product');
 if(product){const site=(await currentSite()).key;await publicProduct(product,site);
   const r=await pool.query('SELECT id,category,message,reply,created_at,replied_at FROM customer_questions WHERE product_id=$1 AND site=$2 AND is_public=true AND reply IS NOT NULL ORDER BY replied_at DESC LIMIT 50',[product,site]);
   return Response.json({items:r.rows});}
 const a=await customerAccess(false);
 const r=await pool.query(`SELECT q.id,q.product_id,q.order_id,q.category,q.message,q.reply,q.created_at,q.replied_at,o.order_number,p.name AS product_name
   FROM customer_questions q LEFT JOIN orders o ON o.id=q.order_id LEFT JOIN products_shop p ON p.id=q.product_id
   WHERE q.site=$1 AND (q.user_id=$2 OR (q.user_id IS NULL AND q.guest_hash=$3)) ORDER BY q.created_at DESC LIMIT 100`,[a.site,a.id,a.guestHash]);
 return Response.json({items:r.rows},{headers:{'Cache-Control':'no-store'}});
});
export const POST=withApiErrors('POST /api/customer/questions',async(req:Request)=>{
 sameOrigin(req);const a=await customerAccess(false);const b=await readJsonObject(req);
 if(!isUuid(b.request_key))throw new ApiError('INVALID_INPUT');
 const message=inputText(b.message,3000),category=inputText(b.category,30);
 if(!['상품 문의','주문·배송','품질 문제','교환·반품','기타'].includes(category))throw new ApiError('INVALID_INPUT');
 if(b.order_id)await ownedOrder(b.order_id,a);
 if(b.product_id)await publicProduct(b.product_id,a.site);
 if(!a.id && !b.order_id)throw new ApiError('INVALID_INPUT','비회원 문의는 본인 인증 후 주문 내역에서 접수해주세요.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`questions:${a.site}:${a.id||a.guestHash}`]);
  const prior=await db.query('SELECT id FROM customer_questions WHERE site=$1 AND request_key=$2 AND (user_id=$3 OR (user_id IS NULL AND guest_hash=$4))',[a.site,b.request_key,a.id,a.guestHash]);
  if(prior.rows[0]){await db.query('COMMIT');return Response.json({ok:true,id:prior.rows[0].id});}
  const count=await db.query("SELECT count(*)::int n FROM customer_questions WHERE site=$1 AND (user_id=$2 OR (user_id IS NULL AND guest_hash=$3)) AND created_at>now()-INTERVAL '1 hour'",[a.site,a.id,a.guestHash]);
  if(count.rows[0].n>=10)throw new ApiError('RATE_LIMITED');
  const id=randomUUID();await db.query(`INSERT INTO customer_questions(id,site,user_id,guest_hash,product_id,order_id,request_key,category,message,public_requested)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,a.site,a.id,a.id?null:a.guestHash,b.product_id||null,b.order_id||null,b.request_key,category,message,!!b.product_id&&!b.order_id&&b.public_requested===true]);
  await db.query('COMMIT');return Response.json({ok:true,id});
 }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
