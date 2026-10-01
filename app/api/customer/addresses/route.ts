import {randomUUID} from 'node:crypto';
import {ApiError,readJsonObject,rollbackSafely,withApiErrors} from '@/lib/api-errors';
import {customerAccess,inputText,isUuid,sameOrigin} from '@/lib/customer-access';
import pool from '@/lib/db-shop';
export const GET=withApiErrors('GET /api/customer/addresses',async()=>{
 const a=await customerAccess();const r=await pool.query('SELECT id,label,recipient,phone,zipcode,address,detail FROM customer_addresses WHERE site=$1 AND user_id=$2 ORDER BY updated_at DESC',[a.site,a.id]);
 return Response.json({items:r.rows},{headers:{'Cache-Control':'no-store'}});
});
export const POST=withApiErrors('POST /api/customer/addresses',async(req:Request)=>{
 sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);
 const fields=[inputText(b.label,30),inputText(b.recipient,50),inputText(b.phone,30).replace(/\D/g,''),inputText(b.zipcode,5),inputText(b.address,200),inputText(b.detail??'',200,false)];
 if(!/^\d{5}$/.test(fields[3])||!/^0\d{8,10}$/.test(fields[2]))throw new ApiError('INVALID_INPUT','우편번호와 연락처를 확인해주세요.');
 const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`addresses:${a.site}:${a.id}`]);
  const count=await db.query('SELECT count(*)::int n FROM customer_addresses WHERE site=$1 AND user_id=$2 AND label<>$3',[a.site,a.id,fields[0]]);
  if(count.rows[0].n>=10)throw new ApiError('INVALID_INPUT','배송지는 10개까지 저장할 수 있습니다.');
  await db.query(`INSERT INTO customer_addresses(id,site,user_id,label,recipient,phone,zipcode,address,detail) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(site,user_id,label) DO UPDATE SET recipient=EXCLUDED.recipient,phone=EXCLUDED.phone,zipcode=EXCLUDED.zipcode,address=EXCLUDED.address,detail=EXCLUDED.detail,updated_at=now()`,[randomUUID(),a.site,a.id,...fields]);
  await db.query('COMMIT');return Response.json({ok:true});
 }catch(e){await rollbackSafely(db);throw e;}finally{db.release();}
});
export const DELETE=withApiErrors('DELETE /api/customer/addresses',async(req:Request)=>{
 sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);if(!isUuid(b.id))throw new ApiError('INVALID_INPUT');
 await pool.query('DELETE FROM customer_addresses WHERE id=$1 AND site=$2 AND user_id=$3',[b.id,a.site,a.id]);return Response.json({ok:true});
});
