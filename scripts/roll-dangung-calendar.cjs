const {today,validateConfig}=require('../lib/dangung-core.cjs');
const {LAUNCH_REVISION,PRICING_PLAN,nightlyPrice}=require('../lib/dangung-pricing.cjs');
const add=(day,n)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
// Same settings-row lock as booking transactions. New dates only: preserve admin overrides/closures and reservations.
async function roll(pool,{launch=false,now=new Date()}={}){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const {rows:[settings]}=await c.query('SELECT * FROM dangung_settings WHERE id=1 FOR UPDATE');
  if(!settings)throw Error('Dangung settings missing');
  let config=settings.config;
  const initial=launch&&!config.saleLaunchRevision;
  if(initial){
   config={...config,enabled:true,saleLaunchRevision:LAUNCH_REVISION,saleStart:'2026-09-16',rollingCalendar:true,pricingPlan:PRICING_PLAN};
   validateConfig(config);
  }
  if(config.saleLaunchRevision!==LAUNCH_REVISION||!config.rollingCalendar){await c.query('COMMIT');return {skipped:true};}
  const first=[config.saleStart,add(today(now),config.minLeadDays)].sort().at(-1),last=add(today(now),365);
  const dates=[];
  for(let day=first;day<=last;day=add(day,1))dates.push(nightlyPrice(day,config.pricingPlan));
  const inserted=await c.query(`INSERT INTO dangung_dates(day,price,season,available)
   SELECT x.day,x.price,x.season,x.available FROM jsonb_to_recordset($1::jsonb) AS x(day date,price integer,season text,available boolean)
   ON CONFLICT(day) DO NOTHING RETURNING day`,[JSON.stringify(dates)]);
  if(initial||inserted.rows.length){
   await c.query('UPDATE dangung_settings SET config=$1,version=version+1 WHERE id=1',[JSON.stringify(config)]);
   await c.query('INSERT INTO dangung_audit(action,detail) VALUES($1,$2)',[initial?'sale_opened':'calendar_extended',JSON.stringify({revision:LAUNCH_REVISION,first,last,inserted:inserted.rows.length})]);
  }
  await c.query('COMMIT');
  return {enabled:config.enabled,first,last,inserted:inserted.rows.length,opened:initial};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
module.exports={roll};
if(require.main===module){
 require('@next/env').loadEnvConfig(process.cwd(),false);
 const {Pool}=require('pg');
 const launch=process.argv.includes('--launch');
 if(launch&&(!process.env.TOSS_CLIENT_KEY?.startsWith('live_ck_')||!process.env.TOSS_SECRET_KEY?.startsWith('live_sk_')))throw Error('Live payment configuration required');
 if(!process.env.SHOP_DATABASE_URL)throw Error('Shop database required');
 const pool=new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
 roll(pool,{launch}).then(r=>console.log('Dangung calendar: '+JSON.stringify(r))).catch(()=>{console.error('Dangung calendar update failed; transaction rolled back');process.exitCode=1;}).finally(()=>pool.end());
}
