const fs=require('node:fs'),path=require('node:path'),{Pool}=require('pg');
require('@next/env').loadEnvConfig(process.cwd(),false);
async function retain(){
  if(!process.env.ANALYTICS_DATABASE_URL||(process.env.ANALYTICS_HASH_SECRET?.length||0)<32)throw Error('CONFIGURATION_MISSING');
  const pool=new Pool({connectionString:process.env.ANALYTICS_DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:30000});
  try{await pool.query(fs.readFileSync(path.join(__dirname,'../ops/sql/visit-analytics-retention.sql'),'utf8'));console.log('Visit analytics: 90-day retention applied.');}
  finally{await pool.end();}
}
retain().catch(e=>{console.error('Visit analytics retention failed: '+(e.code||'RETENTION_FAILED'));process.exitCode=1;});
