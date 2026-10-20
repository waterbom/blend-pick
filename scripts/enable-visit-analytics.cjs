// One-time activation requested by the operator. Credentials stay on the server.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Pool}=require('pg');
const DATABASE='blendpick_analytics',ROLE='blendpick_analytics_app';
function saveSettings(file,values){
  let contents=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  for(const [key,value] of Object.entries(values)){
    if(!/^ANALYTICS_[A-Z_]+$/.test(key)||/[\r\n\0]/.test(value))throw Error('INVALID_SETTING');
    contents=contents.replace(new RegExp('^(?:export\\s+)?'+key+'\\s*=.*(?:\\r?\\n|$)','gm'),'');
    contents+=(contents.endsWith('\n')?'':'\n')+key+'='+JSON.stringify(value).replace(/\$/g,'\\$')+'\n';
  }
  const temp=file+'.analytics-'+crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(temp,contents,{mode:0o600,flag:'wx'});
  fs.renameSync(temp,file);
}
function targetUrl(source,username,password){
  const url=new URL(source);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('INVALID_DATABASE_URL');
  if(['user','password','database','dbname','host','hostaddr','port'].some(key=>url.searchParams.has(key)))throw Error('UNSUPPORTED_CONNECTION_OPTIONS');
  url.pathname='/'+DATABASE;
  if(username){url.username=username;url.password=password;}
  // Preserve explicitly configured TLS. The existing shop pool uses TLS without CA verification.
  if(!url.searchParams.has('sslmode'))url.searchParams.set('sslmode','no-verify');
  return url.toString();
}
async function enable({env=process.env,cwd=process.cwd(),createPool=o=>new Pool(o)}={}){
  const pending=env.ANALYTICS_BOOTSTRAP_PENDING==='true';
  if(env.ANALYTICS_DATABASE_URL && (env.ANALYTICS_HASH_SECRET?.length||0)>=32 && !pending){
    console.log('Visit analytics activation: existing settings preserved.');return 'existing';
  }
  if(!pending && (env.ANALYTICS_DATABASE_URL||env.ANALYTICS_HASH_SECRET))throw Error('PARTIAL_CONFIGURATION');
  if(!env.SHOP_DATABASE_URL)throw Error('PROVISIONING_CONNECTION_MISSING');
  const admin=createPool({connectionString:env.SHOP_DATABASE_URL,ssl:{rejectUnauthorized:false},max:1,connectionTimeoutMillis:5000,statement_timeout:30000});
  const settingsFile=path.join(cwd,'.env.local');
  try{
    const privileges=(await admin.query('SELECT rolcreatedb,rolcreaterole,rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0];
    if(!privileges||!(privileges.rolcreatedb||privileges.rolsuper)||!(privileges.rolcreaterole||privileges.rolsuper))throw Error('PROVISIONING_PERMISSION_MISSING');
    const role=(await admin.query("SELECT shobj_description(oid,'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",[ROLE])).rows[0];
    const database=(await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",[DATABASE])).rows[0];
    const installation=pending?env.ANALYTICS_BOOTSTRAP_ID:crypto.randomUUID();
    if(!/^[a-f0-9-]{36}$/.test(installation||''))throw Error('INVALID_SETUP_ID');
    const marker='blendpick-analytics-v1:'+installation;
    if((role&&(!pending||role.marker!==marker))||(database&&(!pending||database.marker!==marker)))throw Error('UNMANAGED_STORAGE_EXISTS');
    const password=pending?decodeURIComponent(new URL(env.ANALYTICS_DATABASE_URL).password):crypto.randomBytes(32).toString('hex');
    if(!/^[a-f0-9]{64}$/.test(password))throw Error('INVALID_SETUP_CREDENTIAL');
    const settings={ANALYTICS_ENABLED:'false',ANALYTICS_DATABASE_URL:targetUrl(env.SHOP_DATABASE_URL,ROLE,password),ANALYTICS_HASH_SECRET:pending?env.ANALYTICS_HASH_SECRET:crypto.randomBytes(48).toString('hex'),ANALYTICS_BOOTSTRAP_ID:installation,ANALYTICS_BOOTSTRAP_PENDING:'true'};
    if((settings.ANALYTICS_HASH_SECRET?.length||0)<32)throw Error('INVALID_HASH_KEY');
    // Keep the same credentials if a deployment is interrupted. No existing data is dropped.
    if(!pending)saveSettings(settingsFile,settings);
    if(!role){
      await admin.query('BEGIN');
      try{await admin.query(`CREATE ROLE ${ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);await admin.query(`COMMENT ON ROLE ${ROLE} IS '${marker}'`);await admin.query('COMMIT');}
      catch(e){await admin.query('ROLLBACK').catch(()=>{});throw e;}
    }
    if(!database){await admin.query(`CREATE DATABASE ${DATABASE}`);await admin.query(`COMMENT ON DATABASE ${DATABASE} IS '${marker}'`);}
    await admin.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE}`);
    const owner=createPool({connectionString:targetUrl(env.SHOP_DATABASE_URL),max:1,connectionTimeoutMillis:5000,statement_timeout:15000});
    try{
      await owner.query(fs.readFileSync(path.join(__dirname,'../ops/sql/visit-analytics.sql'),'utf8'));
      await owner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await owner.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON analytics_sessions,analytics_pageviews TO ${ROLE}`);
    }finally{await owner.end();}
    const app=createPool({connectionString:settings.ANALYTICS_DATABASE_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:5000});
    try{await app.query('SELECT site,event_id,visitor_hash,session_id,page,occurred_at FROM analytics_pageviews LIMIT 0');await app.query('SELECT site,id,visitor_hash,started_at,last_seen_at FROM analytics_sessions LIMIT 0');}finally{await app.end();}
    settings.ANALYTICS_ENABLED='true';settings.ANALYTICS_BOOTSTRAP_PENDING='false';
    saveSettings(settingsFile,settings);Object.assign(env,settings);
    console.log('Visit analytics activation: dedicated database and restricted account ready.');
    return 'enabled';
  }finally{await admin.end();}
}
module.exports={enable,saveSettings,targetUrl};
if(require.main===module){
  require('@next/env').loadEnvConfig(process.cwd(),false);
  if(!process.argv.includes('--enable')){console.error('Explicit --enable required.');process.exitCode=1;}
  else enable().catch(e=>{console.error('Visit analytics activation failed: '+(/^[A-Z_0-9]+$/.test(e.code||e.message)?e.code||e.message:'SETUP_FAILED')+'. Settings and credentials are not printed.');process.exitCode=1;});
}
