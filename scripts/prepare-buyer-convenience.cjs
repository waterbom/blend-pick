const fs=require('node:fs'),path=require('node:path');
async function prepare(pool){ await pool.query(fs.readFileSync(path.join(__dirname,'../ops/sql/buyer-convenience.sql'),'utf8')); }
module.exports={prepare};
if(require.main===module){require('@next/env').loadEnvConfig(process.cwd(),false);const {Pool}=require('pg');
 if(!process.env.SHOP_DATABASE_URL) throw Error('SHOP_DATABASE_URL is required');
 const pool=new Pool({connectionString:process.env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:5000});
 prepare(pool).then(()=>console.log('Buyer convenience schema ready')).catch(()=>{console.error('Buyer convenience schema failed');process.exitCode=1}).finally(()=>pool.end());}
