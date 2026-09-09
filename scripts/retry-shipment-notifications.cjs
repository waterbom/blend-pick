require('@next/env').loadEnvConfig(process.cwd(),false);
const {Pool}=require('pg');
const {sendSMS,smsConfigured}=require('../lib/sms-provider.cjs');
const {processQueue}=require('../lib/shipment-outbox.cjs');
(async()=>{
 if(!smsConfigured()){console.log('Shipment SMS disabled: provider not configured');return;}
 if(!process.env.SHOP_DATABASE_URL)throw Error('Database configuration missing');
 const pool=new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
 try{const result=await processQueue(pool,sendSMS,{limit:50});console.log(JSON.stringify(result));if(result.failed)process.exitCode=1;}finally{await pool.end();}
})().catch(()=>{console.error('Shipment notification worker failed; inspect pending queue');process.exitCode=1;});
