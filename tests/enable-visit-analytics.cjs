const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {enable,targetUrl}=require('../scripts/enable-visit-analytics.cjs');
function fixture(options={}){
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'visit-setup-'));
 const env={SHOP_DATABASE_URL:'postgresql://owner:example@db.invalid/commerce'};
 const state={role:null,database:null,queries:[],...options};
 const settings=()=>Object.fromEntries(fs.readFileSync(path.join(cwd,'.env.local'),'utf8').split('\n').filter(l=>l.startsWith('ANALYTICS_')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),JSON.parse(l.slice(i+1))]}));
 const createPool=o=>{
  const url=new URL(o.connectionString),kind=url.pathname==='/commerce'?'admin':url.username==='owner'?'owner':'app';
  return {end:async()=>{},query:async(sql)=>{
   state.queries.push({kind,sql});
   if(sql.startsWith('SELECT rolcreatedb'))return {rows:[{rolcreatedb:!state.denied,rolcreaterole:!state.denied,rolsuper:false}]};
   if(sql.includes("shobj_description(oid,'pg_authid')"))return {rows:state.role?[state.role]:[]};
   if(sql.includes("shobj_description(oid,'pg_database')"))return {rows:state.database?[state.database]:[]};
   if(sql.startsWith('CREATE ROLE'))state.role={marker:null};
   if(sql.startsWith('COMMENT ON ROLE'))state.role.marker=sql.match(/IS '([^']+)'/)[1];
   if(sql.startsWith('CREATE DATABASE')){if(state.failCreateDb){state.failCreateDb=false;throw Error('SETUP_INTERRUPTED');}state.database={marker:null};}
   if(sql.startsWith('COMMENT ON DATABASE'))state.database.marker=sql.match(/IS '([^']+)'/)[1];
   if(kind==='app'&&!sql.startsWith('SELECT '))throw Error('Runtime account must not perform DDL');
   return {rows:[]};
  }};
 };
 return {cwd,env,state,settings,createPool,remove:()=>fs.rmSync(cwd,{recursive:true,force:true})};
}
test('activation creates isolated storage, restricted runtime account and private settings',async()=>{
 const f=fixture();try{
  const file=path.join(f.cwd,'.env.local');fs.writeFileSync(file,'EXISTING_OPTION="keep-this"\n');
  assert.equal(await enable(f),'enabled');const saved=f.settings();
  assert.equal(saved.ANALYTICS_ENABLED,'true');assert.equal(saved.ANALYTICS_BOOTSTRAP_PENDING,'false');
  assert.equal(new URL(saved.ANALYTICS_DATABASE_URL).pathname,'/blendpick_analytics');
  assert.equal(new URL(saved.ANALYTICS_DATABASE_URL).username,'blendpick_analytics_app');
  assert.ok(saved.ANALYTICS_HASH_SECRET.length>=32);assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.match(fs.readFileSync(file,'utf8'),/EXISTING_OPTION="keep-this"/);
  assert.ok(f.state.queries.some(x=>/NOSUPERUSER NOCREATEDB NOCREATEROLE/.test(x.sql)));
  assert.ok(f.state.queries.filter(x=>/CREATE TABLE/.test(x.sql)).every(x=>x.kind==='owner'&&!x.sql.includes('orders')));
  const before=fs.readFileSync(file,'utf8'),count=f.state.queries.length;
  assert.equal(await enable(f),'existing');assert.equal(f.state.queries.length,count);assert.equal(fs.readFileSync(file,'utf8'),before);
 }finally{f.remove();}
});
test('interrupted activation resumes with the same key and password without replacing the role',async()=>{
 const f=fixture({failCreateDb:true});try{
  await assert.rejects(enable(f),/SETUP_INTERRUPTED/);const before=f.settings();
  assert.equal(before.ANALYTICS_ENABLED,'false');assert.equal(before.ANALYTICS_BOOTSTRAP_PENDING,'true');
  Object.assign(f.env,before);assert.equal(await enable(f),'enabled');const after=f.settings();
  assert.equal(after.ANALYTICS_HASH_SECRET,before.ANALYTICS_HASH_SECRET);assert.equal(after.ANALYTICS_DATABASE_URL,before.ANALYTICS_DATABASE_URL);
  assert.equal(f.state.queries.filter(q=>q.sql.startsWith('CREATE ROLE')).length,1);
  assert.ok(!f.state.queries.some(q=>/ALTER ROLE|DROP DATABASE|DROP ROLE/.test(q.sql)));
 }finally{f.remove();}
});
test('missing privileges and unrelated existing storage fail before changing settings',async()=>{
 for(const options of [{denied:true},{role:{marker:'someone-else'}},{database:{marker:'someone-else'}}]){
  const f=fixture(options);try{await assert.rejects(enable(f),/PERMISSION_MISSING|UNMANAGED_STORAGE/);assert.ok(!fs.existsSync(path.join(f.cwd,'.env.local')));assert.ok(!f.state.queries.some(q=>q.sql.startsWith('CREATE ')));}finally{f.remove();}
 }
});
test('operator configuration, including intentional disable, remains unchanged',async()=>{
 const env={ANALYTICS_ENABLED:'false',ANALYTICS_DATABASE_URL:'postgresql://provided.invalid/existing',ANALYTICS_HASH_SECRET:'x'.repeat(32)};
 assert.equal(await enable({env,createPool:()=>{throw Error('must not connect')}}),'existing');assert.equal(env.ANALYTICS_ENABLED,'false');
 await assert.rejects(enable({env:{ANALYTICS_DATABASE_URL:'partial'},createPool:()=>{throw Error('must not connect')}}),/PARTIAL_CONFIGURATION/);
 const url=new URL(targetUrl('postgresql://owner:password@db.invalid/orders?sslmode=verify-full','app','a'.repeat(64)));
 assert.equal(url.searchParams.get('sslmode'),'verify-full');assert.equal(url.pathname,'/blendpick_analytics');
 assert.throws(()=>targetUrl('postgresql://owner:password@db.invalid/orders?user=owner','app','a'.repeat(64)),/UNSUPPORTED_CONNECTION_OPTIONS/);
});
