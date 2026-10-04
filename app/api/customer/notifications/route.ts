import {ApiError,readJsonObject,withApiErrors} from '@/lib/api-errors';
import {customerAccess,isUuid,sameOrigin} from '@/lib/customer-access';
import pool from '@/lib/db-shop';
export const GET=withApiErrors('GET /api/customer/notifications',async()=>{
 const a=await customerAccess();
 const r=await pool.query("SELECT id,title,body,href,read_at,created_at FROM customer_notifications WHERE site=$1 AND user_id=$2 AND status<>'cancelled' ORDER BY created_at DESC LIMIT 100",[a.site,a.id]);
 return Response.json({items:r.rows},{headers:{'Cache-Control':'no-store'}});
});
export const PATCH=withApiErrors('PATCH /api/customer/notifications',async(req:Request)=>{
 sameOrigin(req);const a=await customerAccess();const b=await readJsonObject(req);if(!isUuid(b.id))throw new ApiError('INVALID_INPUT');
 await pool.query('UPDATE customer_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND site=$2 AND user_id=$3',[b.id,a.site,a.id]);
 return Response.json({ok:true});
});
