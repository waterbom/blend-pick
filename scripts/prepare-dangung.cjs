const fs=require('node:fs'),path=require('node:path');
const {APPROVED_SETTINGS}=require('../lib/dangung-policy.cjs');
async function prepare(pool){
 await pool.query(fs.readFileSync(path.join(__dirname,'dangung.sql'),'utf8'));
 // Apply approved terms once. Preserve sales state, dates, reservations and later edits.
 await pool.query("UPDATE dangung_settings SET config=config || $1::jsonb,version=version+1 WHERE id=1 AND config->>'saleTermsRevision' IS DISTINCT FROM $2",[JSON.stringify(APPROVED_SETTINGS),APPROVED_SETTINGS.saleTermsRevision]);
}
module.exports={prepare};
if(require.main===module){require('@next/env').loadEnvConfig(process.cwd(),false);const {Pool}=require('pg');
 if(!process.env.SHOP_DATABASE_URL)throw Error('SHOP_DATABASE_URL is required');
 const pool=new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
 prepare(pool).then(()=>console.log('Dangung schema ready; existing sales settings preserved')).catch(()=>{console.error('Dangung schema migration failed');process.exitCode=1}).finally(()=>pool.end());}
