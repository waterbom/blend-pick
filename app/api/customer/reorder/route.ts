import {createHash} from 'node:crypto';
import {ApiError,readJsonObject,rollbackSafely,withApiErrors} from '@/lib/api-errors';
import {customerAccess,isUuid,ownedOrder,sameOrigin} from '@/lib/customer-access';
import {resolveCartItem} from '@/lib/cart-catalog';
import pool from '@/lib/db-shop';
import type {SiteKey} from '@/lib/sites';
async function selection(order:string,site:SiteKey,db:Pick<typeof pool,'query'>=pool){
 const result=await db.query('SELECT product_id,option_id,sum(quantity)::int quantity FROM order_items WHERE order_id=$1 GROUP BY product_id,option_id ORDER BY product_id,option_id',[order]);
 if(!result.rows.length||result.rows.some(i=>!i.product_id))throw new ApiError('STATE_CONFLICT','추가 상품 등이 포함된 주문입니다. 상품 화면에서 구성을 다시 선택해주세요.');
 const items=[];for(const row of result.rows)items.push(await resolveCartItem(row,site,db));
 const quote=createHash('sha256').update(JSON.stringify(items.map(i=>[i.product_id,i.option_id,i.quantity,i.price]))).digest('hex');
 return {items:items.map(i=>({product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,name:i.name,option_label:i.option_value,price:i.price})),quote};
}
export const GET=withApiErrors('GET /api/customer/reorder',async(req:Request)=>{
 const a=await customerAccess();const order=await ownedOrder(new URL(req.url).searchParams.get('order'),a);
 const result=await selection(order.id,a.site);return Response.json(result,{headers:{'Cache-Control':'no-store'}});
});
export const POST=withApiErrors('POST /api/customer/reorder',async(req:Request)=>{
 sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);if(!isUuid(b.request_key))throw new ApiError('INVALID_INPUT');
 const order=await ownedOrder(b.order_id,a),db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`reorder:${a.site}:${a.id}:${b.request_key}`]);
  const prior=await db.query('SELECT order_id FROM customer_reorder_requests WHERE site=$1 AND user_id=$2 AND request_key=$3',[a.site,a.id,b.request_key]);
  if(prior.rows[0]){if(prior.rows[0].order_id!==order.id)throw new ApiError('STATE_CONFLICT');await db.query('COMMIT');return Response.json({ok:true});}
  const selected=await selection(order.id,a.site,db);if(selected.quote!==b.quote)throw new ApiError('STATE_CONFLICT','상품 가격이 변경되었습니다. 다시 구매할 내역을 새로 확인해주세요.');
  for(const item of selected.items){
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`cart:${a.site}:${a.id}:${item.product_id}:${item.option_id??''}`]);
   const existing=await db.query('SELECT id,quantity FROM cart WHERE site=$1 AND user_id::text=$2 AND product_id=$3 AND option_id IS NOT DISTINCT FROM $4::uuid FOR UPDATE',[a.site,a.id,item.product_id,item.option_id]);
   const qty=(existing.rows[0]?.quantity||0)+item.quantity;
   await resolveCartItem({...item,quantity:qty},a.site,db);
   if(existing.rows[0])await db.query('UPDATE cart SET quantity=$2 WHERE id=$1',[existing.rows[0].id,qty]);
   else await db.query('INSERT INTO cart(user_id,site,product_id,option_id,quantity) VALUES($1,$2,$3,$4,$5)',[a.id,a.site,item.product_id,item.option_id,item.quantity]);
  }
  await db.query('INSERT INTO customer_reorder_requests(site,user_id,request_key,order_id) VALUES($1,$2,$3,$4)',[a.site,a.id,b.request_key,order.id]);
  await db.query('COMMIT');return Response.json({ok:true});
 }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
