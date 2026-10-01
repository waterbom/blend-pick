import {ApiError,readJsonObject,withApiErrors} from '@/lib/api-errors';
import {adminAccess,inputText,isUuid} from '@/lib/customer-access';
import {PRODUCT_CARE_FIELDS} from '@/lib/product-care';
import pool from '@/lib/db-shop';
import {SITES,type SiteKey} from '@/lib/sites';
async function product(id:unknown,site:SiteKey){
 if(!isUuid(id))throw new ApiError('INVALID_INPUT');
 const r=await pool.query(`SELECT id FROM products_shop WHERE id=$1 AND CASE WHEN $2='sanjipick' THEN category=ANY($3::text[]) ELSE NOT COALESCE(category=ANY($3::text[]),false) END`,[id,site,SITES.sanjipick.categories]);
 if(!r.rows[0])throw new ApiError('NOT_FOUND');
}
export const GET=withApiErrors('GET /api/admin/product-care',async(req:Request)=>{
 const site=await adminAccess();const id=new URL(req.url).searchParams.get('product');await product(id,site);
 const r=await pool.query('SELECT * FROM product_customer_info WHERE product_id=$1',[id]);return Response.json({info:r.rows[0]||{},haccpConfigured:!!process.env.HACCP_SERVICE_KEY});
});
export const PUT=withApiErrors('PUT /api/admin/product-care',async(req:Request)=>{
 const site=await adminAccess(req);const b=await readJsonObject(req);await product(b.product_id,site);
 const keys=Object.keys(PRODUCT_CARE_FIELDS),values=keys.map(k=>inputText(b[k]??'',1000,false));
 await pool.query(`INSERT INTO product_customer_info(product_id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>'$'+(i+2)).join(',')})
   ON CONFLICT(product_id) DO UPDATE SET ${keys.map(k=>k+'=EXCLUDED.'+k).join(',')},updated_at=now()`,[b.product_id,...values]);
 return Response.json({ok:true});
});
