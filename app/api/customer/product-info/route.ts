import {withApiErrors} from '@/lib/api-errors';
import {publicProduct} from '@/lib/customer-access';
import {currentSite} from '@/lib/site-server';
import {configuration} from '@/lib/commerce-provider.cjs';
import pool from '@/lib/db-shop';
export const GET=withApiErrors('GET /api/customer/product-info',async(req:Request)=>{
 const site=(await currentSite()).key;const id=new URL(req.url).searchParams.get('product');await publicProduct(id,site);
 const info=await pool.query('SELECT producer,storage,shelf_life,allergens,quality_policy,return_fee,certification_number,certification_scope FROM product_customer_info WHERE product_id=$1',[id]);
 return Response.json({info:info.rows[0]||null,channels:configuration(site)});
});
