require('@next/env').loadEnvConfig(process.cwd(),false);
const {discoverOrders,discoverInterests,processQueue}=require('../lib/customer-notifications.cjs');
(async()=>{
  if(!process.env.SHOP_DATABASE_URL) throw Object.assign(Error('Database configuration missing'),{code:'DATABASE_CONFIGURATION_MISSING'});
  const pool=new (require('pg').Pool)({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
  try { await discoverOrders(pool); await discoverInterests(pool); const result=await processQueue(pool); console.log(JSON.stringify(result)); if(result.review) process.exitCode=1; }
  finally {await pool.end();}
})().catch(error=>{
  const code=error?.code||error?.errors?.[0]?.code;
  console.error(JSON.stringify({event:'customer_notification_worker_failed',sourceCode:typeof code==='string'&&/^[A-Z0-9_]{1,60}$/.test(code)?code:'UNKNOWN',action:'Inspect server configuration and customer notification queue'}));
  process.exitCode=1;
});
