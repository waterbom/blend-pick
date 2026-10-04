import {ApiError,readJsonObject,withApiErrors} from '@/lib/api-errors';
import {adminAccess,inputText,isUuid} from '@/lib/customer-access';
import pool from '@/lib/db-shop';
export const PUT=withApiErrors('PUT /api/admin/review-replies',async(req:Request)=>{
 const site=await adminAccess(req),b=await readJsonObject(req);if(!isUuid(b.id))throw new ApiError('INVALID_INPUT');
 const reply=inputText(b.reply,2000);
 const result=await pool.query(`INSERT INTO review_replies(review_id,reply) SELECT r.id,$3 FROM reviews r JOIN orders o ON o.id=r.order_id WHERE r.id=$1 AND o.site=$2
  ON CONFLICT(review_id) DO UPDATE SET reply=EXCLUDED.reply,updated_at=now() RETURNING review_id`,[b.id,site,reply]);
 if(!result.rowCount)throw new ApiError('NOT_FOUND');return Response.json({ok:true});
});
