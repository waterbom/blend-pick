// Isolated PostgreSQL and real API handlers. No production access or real messages.
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const setup=require('./support/integrity-schema.cjs');
const {CORE_CARRIERS}=load('lib/carriers.ts');
const {normalizeImportRows,reviewImport}=load('lib/tracking-import.ts');
const {trackingRows}=load('lib/shipping-flow.ts');
const db=new PGlite();let site='blendpick',auth=true,admin='operator',sent=0,hook=null,tail=Promise.resolve();
process.env.ADMIN_JWT_SECRET='isolated-shipment-import-test-secret';
const native=async(sql,p=[])=>{const r=await db.query(sql,p);return {...r,rowCount:r.affectedRows??r.rows.length};};
const query=(sql,p=[])=>hook?hook(sql,p,native):native(sql,p);
async function lock(){const previous=tail;let release;tail=new Promise(r=>release=r);await previous;return release;}
const pool={query:async(...args)=>{const release=await lock();try{return await query(...args);}finally{release();}},connect:async()=>{const release=await lock();return{query,release};}};
const mocks={'@/lib/db-shop':pool,'@/lib/auth':{verifyAdminToken:async()=>auth?{id:admin,email:'admin@blendpick.com'}:null},'next/headers':{cookies:async()=>({get:()=>({value:'test'})}),headers:async()=>new Headers({host:site==='blendpick'?'shop.blendpunch.com':'sanjipick.blendpunch.com'})},'@/lib/shipment-carriers':{shipmentCarriers:async()=>({carriers:CORE_CARRIERS})},'@/lib/sms':{smsConfigured:()=>true,sendSMS:async()=>{sent++;return{ok:true};}}};
const cache=new Map();
const preview=load('app/api/admin/shipments/import/preview/route.ts',mocks,cache).POST;
const commit=load('app/api/admin/shipments/import/route.ts',mocks,cache).POST;
const req=body=>new Request('https://test.invalid/api/admin/shipments/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const row=(n=1,number='001-234',carrier='cj대한통운')=>({order_number:'TEST'+n,tracking_number:number,carrier,source_row:n+1,source_sheet:'송장'});
async function order(n=1,status='preparing',scope=site,number=null,carrier=null){await native('INSERT INTO orders(id,order_number,site,status,order_type,buyer_name,buyer_phone,tracking_number,tracking_company) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id(n),'TEST'+n,scope,status,'shop','검증','01000000000',number,carrier]);}
async function prepared(rows,extra={}){const body={rows,...extra};const res=await preview(req(body));assert.equal(res.status,200,await res.clone().text());const data=await res.json();return{body:{...body,token:data.token,requestKey:randomUUID()},data};}
async function result(body,status=200){const r=await commit(req(body));assert.equal(r.status,status,await r.clone().text());return r.json();}
async function refund(n=1){await native("INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,payment_key,total,idempotency_key,status) VALUES($1,$2,100,0,'test','test',1000,$1,'processing')",['refund'+n,id(n)]);}
before(async()=>setup(db,id));
beforeEach(async()=>{site='blendpick';auth=true;admin='operator';sent=0;hook=null;await db.exec('TRUNCATE orders,admin_shipment_import_batches CASCADE');});
after(async()=>db.close());

test('source Excel row and sheet survive headers, blanks and reordered columns',()=>{
 const rows=trackingRows([[],['송장번호','택배사','주문번호'],[],['00123','CJ 대한통운','TEST1']], '회신');
 assert.deepEqual(rows,[{order_number:'TEST1',tracking_number:'00123',carrier_raw:'CJ 대한통운',source_row:4,source_sheet:'회신'}]);
});
test('carrier aliases are case/space insensitive; fallback only fills a blank carrier',()=>{
 for(const carrier of ['cj대한통운',' CJ 대한통운 ','CJ','cj','04'])assert.equal(normalizeImportRows([row(1,'000123',carrier)],'05',CORE_CARRIERS)[0].carrier,'04');
 for(const carrier of ['hanjin','한진 택배','05'])assert.equal(normalizeImportRows([row(1,'000123',carrier)],'04',CORE_CARRIERS)[0].carrier,'05');
 for(const carrier of ['unknown','999',4])assert(normalizeImportRows([row(1,'000123',carrier)],'04',CORE_CARRIERS)[0].issue);
 assert.equal(normalizeImportRows([row(1,'000123',' ')],'05',CORE_CARRIERS)[0].carrier,'05');
 for(const number of [123,'1.234E+12','12 34','--',''])assert(normalizeImportRows([row(1,number)],'04',CORE_CARRIERS)[0].issue);
});
for(const scope of ['blendpick','sanjipick'])test(`${scope}: duplicates, suffix rows and cancelled orders preview without writes`,async()=>{
 site=scope;await order(1);await order(2,'cancelled');
 const rows=[row(1),row(1,'001234','CJ 대한통운'),{...row(1),order_number:'TEST1-1'},row(2)];
 const p=await prepared(rows);assert.deepEqual(p.data.counts,{total:4,ready:1,already:0,duplicate:2,blocked:1});
 assert.equal(sent,0);assert.equal((await native('SELECT count(*)::int n FROM shipment_notifications')).rows[0].n,0);
 assert.equal((await native('SELECT count(*)::int n FROM admin_shipment_import_batches')).rows[0].n,0);
 const r=await result(p.body);assert.equal(r.succeeded,1);assert.equal(r.duplicateExcluded,2);assert.equal(r.failed.length,1);assert.equal(sent,1);
 assert.deepEqual((await native('SELECT status,tracking_number FROM orders ORDER BY id')).rows,[{status:'shipped',tracking_number:'001-234'},{status:'cancelled',tracking_number:null}]);
});
test('an exact suffix order is independent; missing or different base row requires review',async()=>{
 await order(1);await order(2);await native("UPDATE orders SET order_number='TEST1-1' WHERE id=$1",[id(2)]);
 let p=await prepared([row(1),{...row(1),order_number:'TEST1-1'}]);assert.equal(p.data.counts.ready,2);assert.equal(p.data.counts.duplicate,0);
 await native('DELETE FROM orders WHERE id=$1',[id(2)]);
 for(const rows of [[{...row(1),order_number:'TEST1-1'}],[row(1),{...row(1,'777'),order_number:'TEST1-1'}]]){
  p=await prepared(rows);assert.equal(p.data.counts.blocked,1);assert.equal(p.data.counts.duplicate,0);
 }
});
test('conflicting invoice, carrier or malformed row blocks the whole order group, not unrelated orders',async()=>{
 for(const bad of [row(1,'999'),row(1,'001234','05'),row(1,'1.23E+5')]){
  await db.exec('TRUNCATE orders,admin_shipment_import_batches CASCADE');await order(1);await order(2);
  const p=await prepared([row(1),bad,row(2)]);assert.equal(p.data.counts.blocked,2);assert.equal(p.data.counts.ready,1);
  const r=await result(p.body);assert.equal(r.succeeded,1);assert.equal((await native('SELECT status FROM orders WHERE id=$1',[id(1)])).rows[0].status,'preparing');
 }
});
test('unconfirmed and terminal orders cannot be promoted by an upload',async()=>{
 const statuses=['paid','confirmed','cancelled','cancel_requested','return_requested','returned','return_completed','exchange_requested','exchange_completed','pending'];
 for(let i=0;i<statuses.length;i++)await order(i+1,statuses[i]);
 const p=await prepared(statuses.map((_,i)=>row(i+1)));assert.equal(p.data.counts.ready,0);assert.equal(p.data.counts.blocked,statuses.length);
 const r=await result(p.body);assert.equal(r.succeeded,0);assert.equal(sent,0);
 assert.deepEqual((await native('SELECT status FROM orders ORDER BY id')).rows.map(o=>o.status),statuses);
});
test('delivered/shipped identical invoices are no-ops; mismatches and missing invoices never overwrite',async()=>{
 await order(1,'shipped',site,'001234','cj');await order(2,'delivered',site,'001-234','04');await order(3,'shipped',site,'999','04');await order(4,'shipped');await order(5,'preparing',site,'999','04');
 await native("UPDATE orders SET shipped_at='2026-01-01' WHERE status IN ('shipped','delivered')");
 const before=(await native('SELECT * FROM orders ORDER BY id')).rows;
 const p=await prepared([1,2,3,4,5].map(n=>row(n)));assert.deepEqual(p.data.counts,{total:5,ready:0,already:2,duplicate:0,blocked:3});
 const r=await result(p.body);assert.equal(r.alreadyApplied,2);assert.equal(r.succeeded,0);assert.equal(sent,0);assert.deepEqual((await native('SELECT * FROM orders ORDER BY id')).rows,before);
});
test('response-loss retry returns the stored result; a new request for the same invoice is a no-op',async()=>{
 await order();const p=await prepared([row()]);const first=await result(p.body),again=await result(p.body);assert.deepEqual(again,first);assert.equal(sent,1);
 const before=(await native('SELECT shipped_at,updated_at FROM orders')).rows;
 const next=await prepared([row()]);assert.equal(next.data.counts.already,1);const r=await result(next.body);assert.equal(r.succeeded,0);assert.equal(r.alreadyApplied,1);assert.equal(sent,1);assert.deepEqual((await native('SELECT shipped_at,updated_at FROM orders')).rows,before);
});
test('concurrent same/different request keys produce one transition and one notification',async()=>{
 await order();const a=await prepared([row()]),b=await prepared([row()]);
 const [first,replay,second]=await Promise.all([result(a.body),result(a.body),result(b.body)]);
 assert.equal(first.succeeded,1);assert.deepEqual(replay,first);assert.equal(second.succeeded,0);assert.equal(second.alreadyApplied,1);assert.equal(sent,1);
 assert.equal((await native('SELECT count(*)::int n FROM shipment_notifications')).rows[0].n,1);
});
test('commit locks sorted target IDs before refreshing the refund snapshot',async()=>{
 await order(1);await order(2);const p=await prepared([row(2),row(1)]);const seen=[];
 hook=async(sql,args,run)=>{seen.push({sql,args});return run(sql,args);};await result(p.body);hook=null;
 const index=seen.findIndex(q=>q.sql.includes('ORDER BY id FOR UPDATE'));assert(index>=0);assert.deepEqual(seen[index].args[1],[id(1),id(2)]);assert(seen[index+1].sql.includes('refund_operations'));
});
test('preview-excluded orders cannot be added after status changes; newly cancelled orders are removed',async()=>{
 await order(1,'cancelled');await order(2);const p=await prepared([row(1),row(2)]);
 await native("UPDATE orders SET status=CASE WHEN id=$1 THEN 'preparing' ELSE 'cancelled' END",[id(1)]);
 const r=await result(p.body);assert.equal(r.succeeded,0);assert.equal(r.failed.length,2);assert.equal(sent,0);
});
test('refund started after preview is excluded without blocking another normal order',async()=>{
 await order(1);await order(2);const p=await prepared([row(1),row(2)]);await refund(1);
 const r=await result(p.body);assert.equal(r.succeeded,1);assert.equal(r.failed.length,1);assert.equal(sent,1);
 assert.equal((await native('SELECT status FROM orders WHERE id=$1',[id(1)])).rows[0].status,'preparing');
});
test('P2001 guard conflicts recover the savepoint; unexpected SQL errors roll back orders, result and outbox',async()=>{
 await order(1);await order(2);let p=await prepared([row(1),row(2)]);
 hook=async(sql,args,run)=>{if(sql.startsWith('UPDATE orders')&&args[0]==='TEST1')return run("DO $$ BEGIN RAISE EXCEPTION USING ERRCODE='P2001', MESSAGE='test refund'; END $$");return run(sql,args);};
 let r=await result(p.body);hook=null;assert.equal(r.succeeded,1);assert.equal(r.failed.length,1);assert.equal(sent,1);
 await db.exec('TRUNCATE orders,admin_shipment_import_batches CASCADE');sent=0;await order(1);await order(2);p=await prepared([row(1),row(2)]);
 hook=async(sql,args,run)=>{if(sql.startsWith('UPDATE orders')&&args[0]==='TEST2')return run('SELECT nonexistent_column FROM orders');return run(sql,args);};
 await result(p.body,500);hook=null;assert.equal(sent,0);assert((await native('SELECT status FROM orders')).rows.every(o=>o.status==='preparing'));
 for(const table of ['shipment_notifications','admin_shipment_import_batches'])assert.equal((await native(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
 assert.equal((await result(p.body)).succeeded,2);
});
test('admin/site/input/token bindings, expiry and request-key reuse are enforced',async()=>{
 await order();const p=await prepared([row()]);
 await result({...p.body,rows:[row(1,'777')]},409);
 await result({...p.body,token:p.body.token+'x'},400);
 site='sanjipick';await result(p.body,409);site='blendpick';
 admin='different';await result(p.body,409);admin='operator';
 const now=Date.now;try{Date.now=()=>now()+16*60*1000;await result(p.body,409);}finally{Date.now=now;}
 assert.equal(sent,0);const first=await result(p.body);
 try{Date.now=()=>now()+16*60*1000;assert.deepEqual(await result(p.body),first);}finally{Date.now=now;}
 const next=await prepared([row()]);await result({...next.body,requestKey:p.body.requestKey},409);
});
test('missing preview and unauthenticated requests are rejected; host excludes foreign orders',async()=>{
 await order(1,'preparing','sanjipick');const p=await prepared([row()]);assert.equal(p.data.counts.blocked,1);assert.equal(p.data.rows[0].current_status,undefined);
 await result({rows:[row()],requestKey:randomUUID()},400);
 auth=false;assert.equal((await preview(req({rows:[row()]}))).status,401);await result(p.body,401);assert.equal(sent,0);
});
test('request size limits are enforced before lookup',async()=>{
 for(const rows of [[],Array(2001).fill(row()),null])assert.equal((await preview(req({rows}))).status,400);
});

test('supplier batch shapes: 334 rows become 323 ready; 58 rows become 44 ready',()=>{
 for(const [unique,duplicates,cancelled,suffix,expected] of [[325,9,2,false,323],[45,13,1,true,44]]){
  const orders=Array.from({length:unique},(_,i)=>({id:id(i+1),order_number:'SAMPLE'+i,status:i<cancelled?'cancelled':'preparing',pending_refunds:false,tracking_company:null,tracking_number:null}));
  const rows=orders.map((o,i)=>({order_number:o.order_number,tracking_number:String(600000000000+i),carrier_raw:suffix?'cj대한통운':'한진택배',source_row:i+2}));
  for(let i=0;i<duplicates;i++){const r=rows[i+cancelled];rows.push({...r,order_number:r.order_number+(suffix?'-1':''),source_row:unique+i+2});}
  const review=reviewImport(normalizeImportRows(rows,'04',CORE_CARRIERS),orders,CORE_CARRIERS);
  assert.deepEqual(review.counts,{total:unique+duplicates,ready:expected,already:0,duplicate:duplicates,blocked:cancelled});
 }
});

test('a previewed no-op cannot turn into a new shipment if an order is reopened before commit',async()=>{
 await order(1,'shipped',site,'001234','04');await order(2);
 const p=await prepared([row(1),row(2)]);assert.equal(p.data.counts.already,1);
 await native("UPDATE orders SET status='preparing' WHERE id=$1",[id(1)]);
 const r=await result(p.body);assert.equal(r.succeeded,1);assert.equal(r.failed.length,1);assert.equal(sent,1);
 assert.equal((await native('SELECT status FROM orders WHERE id=$1',[id(1)])).rows[0].status,'preparing');
});
