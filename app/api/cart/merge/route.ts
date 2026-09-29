import { rollbackSafely, ApiError, withApiErrors, readJsonObject, apiErrorResponse } from '@/lib/api-errors';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {verifyToken} from '@/lib/auth';
import {currentSite} from '@/lib/site-server';
import pool from '@/lib/db-shop';
import {resolveCartItem, CartSelectionError} from '@/lib/cart-catalog';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function handlePOST(req:Request){
 const token=(await cookies()).get('shop_token')?.value;const user=token?await verifyToken(token):null;
 if(!user)return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
 const site=(await currentSite()).key,b=await readJsonObject(req);
 if(!Array.isArray(b?.items)||!b.items.length||b.items.length>30||b.items.some((i:any)=>!uuid.test(i?.id)||!uuid.test(i?.product_id)||(i.option_id&&!uuid.test(i.option_id))||i.link_code||i.is_addon||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>999))return NextResponse.json({error:'장바구니 항목을 확인해주세요.'},{status:400});
 if(new Set(b.items.map((i:any)=>i.id)).size!==b.items.length)return NextResponse.json({error:'중복 항목을 확인해주세요.'},{status:400});
 const alreadyImported:string[]=[];
 const client=await pool.connect();
 let committing=false;
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`guest-merge:${site}:${user.id}`]);
  for(const i of b.items){
   const old=await client.query('SELECT product_id,option_id,quantity FROM guest_cart_imports WHERE site=$1 AND user_id=$2 AND entry_id=$3',[site,user.id,i.id]);
   if(old.rows.length){const p=old.rows[0];if(p.product_id!==i.product_id||(p.option_id||null)!==(i.option_id||null)||p.quantity!==i.quantity)throw new ApiError('STATE_CONFLICT','이미 합친 항목이 변경되었습니다. 장바구니를 다시 확인해주세요.');alreadyImported.push(i.id);continue;}
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`cart:${site}:${user.id}:${i.product_id}:${i.option_id??''}`]);
   const existing=await client.query('SELECT id,quantity FROM cart WHERE user_id=$1 AND product_id=$2 AND option_id IS NOT DISTINCT FROM $3::uuid AND site=$4 LIMIT 1',[user.id,i.product_id,i.option_id||null,site]);
   const total=(existing.rows[0]?.quantity||0)+i.quantity;
   await resolveCartItem({...i,quantity:total},site,client);
   if(existing.rows.length)await client.query('UPDATE cart SET quantity=$1 WHERE id=$2',[total,existing.rows[0].id]);
   else await client.query('INSERT INTO cart(user_id,product_id,option_id,quantity,site) VALUES($1,$2,$3,$4,$5)',[user.id,i.product_id,i.option_id||null,i.quantity,site]);
   await client.query('INSERT INTO guest_cart_imports(site,user_id,entry_id,product_id,option_id,quantity) VALUES($1,$2,$3,$4,$5,$6)',[site,user.id,i.id,i.product_id,i.option_id||null,i.quantity]);
  }
  committing=true;await client.query('COMMIT');return NextResponse.json({ok:true});
 }catch (caughtError){
  const rolledBack=await rollbackSafely(client)&&!committing;
  const failure=rolledBack&&caughtError instanceof CartSelectionError ? new ApiError('STATE_CONFLICT',caughtError.message) : caughtError;
  return apiErrorResponse(failure, {importedIds:alreadyImported,rolledBack},{status:rolledBack?409:503});
 }
 finally{client.release();}
}

export const POST = withApiErrors('POST /api/cart/merge', handlePOST);
