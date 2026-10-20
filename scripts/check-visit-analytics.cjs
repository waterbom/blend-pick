// Exercise real collection with temporary synthetic events, then remove only those events.
const crypto=require('node:crypto');
const {Pool}=require('pg');
async function send(host,body){
  for(let retry=0;retry<4;retry++){
    try{
      const r=await fetch('https://'+host+'/api/analytics/pageview',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://'+host,'User-Agent':'Blendpick-Analytics-Check'},body,signal:AbortSignal.timeout(10000)});
      if(r.status===204)return;
      if(r.status<500||retry===3)throw Error('COLLECTION_HTTP_'+r.status);
    }catch(e){if(retry===3||/^COLLECTION_HTTP_[34]/.test(e.message))throw e;}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
}
async function check(){
  require('@next/env').loadEnvConfig(process.cwd(),false);
  if(process.env.ANALYTICS_ENABLED!=='true')throw Error('COLLECTION_DISABLED');
  if(!process.env.ANALYTICS_DATABASE_URL||(process.env.ANALYTICS_HASH_SECRET?.length||0)<32)throw Error('CONFIGURATION_MISSING');
  const pool=new Pool({connectionString:process.env.ANALYTICS_DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
  try{
    for(const [site,host] of [['blendpick','shop.blendpunch.com'],['sanjipick','sanjipick.blendpunch.com']]){
      const visitorId=crypto.randomUUID(),eventId=crypto.randomUUID();
      const hash=crypto.createHmac('sha256',process.env.ANALYTICS_HASH_SECRET).update(site+':'+visitorId).digest('hex');
      try{
        for(let attempt=0;attempt<2;attempt++){
          await send(host,JSON.stringify({visitorId,eventId,page:'home'}));
        }
        const count=await pool.query('SELECT COUNT(*)::int AS views,COUNT(DISTINCT session_id)::int AS sessions FROM analytics_pageviews WHERE site=$1 AND visitor_hash=$2',[site,hash]);
        if(count.rows[0].views!==1||count.rows[0].sessions!==1)throw Error('COLLECTION_NOT_PERSISTED');
        console.log('Visit analytics live check: '+site+' collection, storage and duplicate suppression passed.');
      }finally{
        await pool.query('DELETE FROM analytics_pageviews WHERE site=$1 AND event_id=$2 AND visitor_hash=$3',[site,eventId,hash]);
        await pool.query('DELETE FROM analytics_sessions s WHERE site=$1 AND visitor_hash=$2 AND NOT EXISTS (SELECT 1 FROM analytics_pageviews p WHERE p.site=s.site AND p.session_id=s.id)',[site,hash]);
      }
    }
    console.log('Visit analytics live check: synthetic events removed; customer totals preserved.');
  }finally{await pool.end();}
}
if(require.main===module)check().catch(e=>{console.error('Visit analytics live check failed: '+(/^[A-Z_0-9]+$/.test(e.code||e.message)?e.code||e.message:'CHECK_FAILED'));process.exitCode=1;});
