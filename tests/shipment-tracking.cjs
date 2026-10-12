const {test,before,beforeEach,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {PGlite} = require('@electric-sql/pglite');
const {load} = require('./support/load.cjs');
const setup = require('./support/integrity-schema.cjs');
const {beginTrackingRun,finishTrackingRun,fetchTrackingStatus} = require('../lib/shipment-tracking-log.cjs');
const db = new PGlite();
let auth=true,site='sanjipick',failWrite=false;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=async(sql,args=[])=>{
 if(failWrite && sql.includes("UPDATE orders SET status = 'delivered'"))throw Error('forced transaction failure');
 const result=await db.query(sql,args);
 return {...result,rowCount:result.affectedRows??result.rows.length};
};
const pool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
const mocks={'@/lib/db-shop':pool,'next/headers':{cookies:async()=>({get:()=>auth?{value:'test'}:undefined})},'@/lib/auth':{verifyAdminToken:async()=>auth?{}:null},'@/lib/admin-site':{currentAdminSite:async()=>({key:site})}};
const route=()=>load('app/api/admin/shipments/track/route.ts',mocks);
const request=(suffix='')=>new Request('https://sanjipick.blendpunch.com/api/admin/shipments/track'+suffix);
const originalFetch=global.fetch,oldKey=process.env.SWEETTRACKER_API_KEY,oldDatabase=process.env.SHOP_DATABASE_URL;
async function order(n,orderSite='sanjipick',carrier='04') {
 await query(`INSERT INTO orders(id,site,order_type,order_number,status,total_amount,payment_key,payment_method,tracking_company,tracking_number)
 VALUES($1,$2,'shop',$3,'shipped',10000,$4,'계좌이체',$5,$6)`,[id(n),orderSite,'ORDER'+n,'test-payment-'+n,carrier,String(1000000000+n)]);
}
before(async()=>{await setup(db,id);});
beforeEach(async()=>{
 auth=true;site='sanjipick';failWrite=false;
 await db.exec('TRUNCATE orders,settlements,shipment_tracking_runs CASCADE');
 process.env.SWEETTRACKER_API_KEY='TRACKER-SECRET-TEST';
 global.fetch=async()=>{throw Error('unmocked network blocked');};
});
after(async()=>{
 global.fetch=originalFetch;
 if(oldKey===undefined)delete process.env.SWEETTRACKER_API_KEY;else process.env.SWEETTRACKER_API_KEY=oldKey;
 if(oldDatabase===undefined)delete process.env.SHOP_DATABASE_URL;else process.env.SHOP_DATABASE_URL=oldDatabase;
 await db.close();
});

test('manual lookup persists real mixed outcomes and never exposes the API key',async()=>{
 await order(1);await order(2);await order(3);await order(4,'blendpick');
 global.fetch=async url=>{
  const invoice=new URL(url).searchParams.get('t_invoice');
  if(invoice==='1000000001')return Response.json({lastStateDetail:{level:6,text:'배송완료'}});
  if(invoice==='1000000002')return Response.json({lastStateDetail:{level:4,text:'배송중'}});
  return Response.json({status:false,code:'LOOKUP_DENIED',msg:'이용권 확인 TRACKER-SECRET-TEST 1000000003'});
 };
 const response=await route().POST(),body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual([body.checked,body.delivered,body.in_transit,body.failed],[3,1,1,1]);
 assert.equal(body.run.status,'partial');
 assert.ok(!JSON.stringify(body).includes('TRACKER-SECRET-TEST'));
 const logs=(await route().GET(request()));const list=await logs.json();
 assert.equal(list.runs.length,1);assert.equal(list.runs[0].checked,3);assert.equal(list.runs[0].results,undefined);
 const detail=await (await route().GET(request('?run='+body.run.id))).json();
 assert.equal(detail.run.results.find(row=>row.order_id===id(3)).code,'LOOKUP_DENIED');
 assert.match((await query('SELECT error FROM shipment_tracking_checks WHERE order_id=$1',[id(3)])).rows[0].error,/이용권 확인/);
 assert.equal((await query('SELECT status FROM orders WHERE id=$1',[id(4)])).rows[0].status,'shipped');
 assert.equal((await query('SELECT COUNT(*)::int n FROM settlements')).rows[0].n,1);
});

test('anonymous requests and cross-site history access are blocked',async()=>{
 const run=await beginTrackingRun(pool,'blendpick','automatic');await finishTrackingRun(pool,run.id,[]);
 assert.equal((await route().GET(request('?run='+run.id))).status,404);
 assert.equal((await (await route().GET(request())).json()).runs.length,0);
 auth=false;assert.equal((await route().GET(request())).status,401);assert.equal((await route().POST()).status,401);
});

test('a manual click cannot overlap an automatic lookup for the same site',async()=>{
 const automatic=await beginTrackingRun(pool,'sanjipick','automatic');
 assert.equal((await route().POST()).status,409);
 assert.ok(await beginTrackingRun(pool,'blendpick','automatic'));
 await finishTrackingRun(pool,automatic.id,[]);
 assert.equal((await route().POST()).status,200);
});

test('delivery rollback is recorded as failed with zero completed deliveries',async()=>{
 await order(1);global.fetch=async()=>Response.json({lastStateDetail:{level:6,text:'배송완료'}});failWrite=true;
 const response=await route().POST(),body=await response.json();failWrite=false;
 assert.equal(response.status,503);assert.equal(body.delivered,0);assert.equal(body.failed,1);assert.equal(body.writeFailed,true);
 assert.equal(body.run.results[0].outcome,'failed');assert.equal(body.run.status,'failed');
 assert.equal((await query('SELECT status FROM orders')).rows[0].status,'shipped');
 assert.equal((await query('SELECT COUNT(*)::int n FROM settlements')).rows[0].n,0);
});

test('a changed order is skipped without reporting a committed delivery',async()=>{
 await order(1);
 global.fetch=async()=>{await query("UPDATE orders SET status='cancelled' WHERE id=$1",[id(1)]);return Response.json({lastStateDetail:{level:6}});};
 const body=await (await route().POST()).json();
 assert.deepEqual([body.checked,body.delivered,body.skipped],[1,0,1]);assert.equal(body.run.results[0].outcome,'skipped');
 assert.equal((await query('SELECT COUNT(*)::int n FROM settlements')).rows[0].n,0);
});

test('empty runs and abandoned runs stay understandable after reload',async()=>{
 const body=await (await route().POST()).json();assert.equal(body.run.status,'empty');assert.equal(body.checked,0);
 const stale=await beginTrackingRun(pool,'sanjipick','automatic');
 await query("UPDATE shipment_tracking_runs SET started_at=NOW()-INTERVAL '31 minutes' WHERE id=$1",[stale.id]);
 const detail=await (await route().GET(request('?run='+stale.id))).json();assert.equal(detail.run.status,'failed');
 assert.equal((await route().POST()).status,200);
 assert.equal((await query('SELECT status FROM shipment_tracking_runs WHERE id=$1',[stale.id])).rows[0].status,'failed');
 await db.exec(fs.readFileSync('ops/sql/commerce-automation.sql','utf8'));
 assert.equal((await query('SELECT COUNT(*)::int n FROM shipment_tracking_runs')).rows[0].n,3);
});

test('provider and timeout failures have safe actionable messages',async()=>{
 global.fetch=async()=>new Response('',{status:429});assert.equal((await fetchTrackingStatus('key','invoice','04')).code,'HTTP_429');
 global.fetch=async()=>{throw Object.assign(Error('key must never be printed'),{name:'TimeoutError'});};
 const result=await fetchTrackingStatus('key','invoice','04');assert.equal(result.code,'TIMEOUT');assert.ok(!result.error.includes('key'));
 global.fetch=async()=>Response.json({hello:'not tracking data'});assert.equal((await fetchTrackingStatus('key','invoice','04')).code,'STATUS_UNAVAILABLE');
});

test('the scheduled worker persists site-specific logs and honors the retry interval',async()=>{
 await order(1);await order(2,'blendpick');await order(3);
 await query("INSERT INTO shipment_tracking_checks(order_id,tracking_number,next_attempt_at) VALUES($1,'1000000003',NOW()+INTERVAL '12 hours')",[id(3)]);
 global.fetch=async()=>Response.json({lastStateDetail:{level:6,text:'배송완료'}});
 const filename=path.resolve('scripts/auto-track-shipments.cjs');const localRequire=createRequire(filename);const mod={exports:{}};
 const requireMock=name=>name==='pg'?{Pool:function(){return pool;}}:name==='@next/env'?{loadEnvConfig(){}}:localRequire(name);
 vm.runInThisContext(`(function(require,module,exports){${fs.readFileSync(filename,'utf8')}\n})`,{filename})(requireMock,mod,mod.exports);
 process.env.SHOP_DATABASE_URL='isolated-test-only';
 await mod.exports.main();
 const runs=(await query('SELECT site,source,checked,delivered,failed FROM shipment_tracking_runs ORDER BY site')).rows;
 assert.deepEqual(runs,[{site:'blendpick',source:'automatic',checked:1,delivered:1,failed:0},{site:'sanjipick',source:'automatic',checked:1,delivered:1,failed:0}]);
 assert.equal((await query('SELECT status FROM orders WHERE id=$1',[id(3)])).rows[0].status,'shipped');
 assert.equal((await query('SELECT COUNT(*)::int n FROM settlements')).rows[0].n,2);
});
