// Read-only deployment report. No customer data, payment credentials, or product writes.
require('@next/env').loadEnvConfig(process.cwd(),false);
const {Pool}=require('pg');
const db=new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false}});
(async()=>{
 const {rows}=await db.query(`SELECT COUNT(*)::int active_products,
 COUNT(*) FILTER(WHERE island_shipping_cost>0 AND COALESCE(trim(remote_zipcodes),'')='')::int region_configuration_needed,
 COUNT(*) FILTER(WHERE shipping_cost<0 OR per_unit_shipping_cost<0 OR installation_cost<0 OR island_shipping_cost<0 OR (shipping_type='conditional_free' AND COALESCE(free_shipping_threshold,0)<=0))::int invalid_fee_settings
 FROM products_shop WHERE status='active' AND archived_at IS NULL`);
 console.log('Shipping configuration report:',JSON.stringify(rows[0]));
 if(rows[0].region_configuration_needed||rows[0].invalid_fee_settings)console.log('Affected products require shipping settings review in admin before checkout. Existing orders are unchanged.');
})().catch(()=>{console.error('Shipping configuration report could not be read.');process.exitCode=1;}).finally(()=>db.end());
