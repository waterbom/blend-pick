const assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup:render}=require('react-dom/server');
const {load}=require('./support/load.cjs');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const db=new PGlite();let count=0;
async function test(name,fn){await fn();console.log('PASS '+name);count++}
const pool={query:(...args)=>db.query(...args)};
const mocks={'@/lib/db-shop':pool};
(async()=>{
 await db.exec(`CREATE TABLE orders(id uuid primary key,site text,order_number text,status text,order_type text default 'shop',paid_at timestamptz,shipped_at timestamptz,created_at timestamptz default now(),tracking_company text,tracking_number text);
 CREATE TABLE products_shop(id uuid primary key,name text,category text,status text,stock int,sale_start_at timestamptz,sale_end_at timestamptz,created_at timestamptz default now());
 CREATE TABLE order_returns(id uuid primary key,order_id uuid,kind text,status text,reason text,created_at timestamptz default now());`);
 const get=load('lib/operations.ts',mocks).getTodayWork;
 await test('72-hour boundary includes paid, confirmed and preparing; excludes hotels, cancelled, other sites and recent payments',async()=>{
  await db.exec('BEGIN'); // NOW is identical for all boundary checks.
  for(const [n,status,hours,site,type] of [[1,'paid',72,'blendpick','shop'],[2,'confirmed',90,'blendpick','campaign'],[3,'preparing',80,'blendpick','shop'],[4,'paid',71,'blendpick','shop'],[5,'cancelled',90,'blendpick','shop'],[6,'paid',90,'sanjipick','shop'],[7,'paid',90,'blendpick','hotel']])
   await db.query(`INSERT INTO orders(id,site,order_number,status,paid_at,order_type) VALUES($1,$2,$3,$4,NOW()-$5*INTERVAL '1 hour',$6)`,[id(n),site,'ORDER-'+n,status,hours,type]);
  const g=(await get('blendpick'))[0];assert.equal(g.total,3);assert.deepEqual(g.items.map(x=>x.id),[id(2),id(3),id(1)]);
  assert.match(g.items[2].elapsed,/3일 0시간/);assert.match(g.items[0].nextAction,/출고 가능일/);assert.match(g.items[1].nextAction,/운송장/);assert.match(g.items[2].nextAction,/발주/);
  await db.exec('COMMIT');
 });
 await test('missing carrier, number, both and missing timestamps are distinguished',async()=>{
  for(const [n,carrier,number,shipped] of [[10,null,null,null],[11,'04',' ','2026-09-06T00:00:00Z'],[12,' ','123','2026-09-05T00:00:00Z'],[13,'04','123',null]])
   await db.query(`INSERT INTO orders(id,site,order_number,status,tracking_company,tracking_number,shipped_at) VALUES($1,'blendpick',$2,'shipped',$3,$4,$5)`,[id(n),'TRACK-'+n,carrier,number,shipped]);
  const g=(await get('blendpick'))[1];assert.equal(g.total,3);assert.equal(g.items[0].id,id(10));assert.match(g.items[0].elapsed,/출고 시각 미기록/);
  assert.match(g.items[0].detail,/모두 누락/);assert.equal(g.items.find(x=>x.id===id(11)).detail,'운송장번호 누락');assert.equal(g.items.find(x=>x.id===id(12)).detail,'택배사 누락');
  assert.ok(g.items.every(x=>x.priority==='first'&&x.href.endsWith('#tracking')));
 });
 await test('stock excludes future, ended, hidden, unlimited and other-site products; zero is first',async()=>{
  for(const [n,stock,status,cat,start,end] of [[20,3,'active',null,null,null],[21,0,'active',null,null,null],[22,2,'active',null,'2099-01-01',null],[23,2,'active',null,null,'2020-01-01'],[24,-1,'active',null,null,null],[25,2,'draft',null,null,null],[26,2,'active','산지픽',null,null]])
   await db.query(`INSERT INTO products_shop(id,name,stock,status,category,sale_start_at,sale_end_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id(n),'PRODUCT-'+n,stock,status,cat,start,end]);
  const g=(await get('blendpick'))[2];assert.equal(g.total,2);assert.equal(g.items[0].id,id(21));assert.equal(g.items[0].priority,'first');assert.equal(g.items[1].priority,'today');
 });
 await test('return request identity, reason and exact kind link survive multiple requests on one order',async()=>{
  for(const [n,order,kind,status] of [[30,1,'return','requested'],[31,1,'exchange','requested'],[32,1,'return','collecting'],[33,6,'return','requested']])
   await db.query(`INSERT INTO order_returns(id,order_id,kind,status,reason) VALUES($1,$2,$3,$4,'상품 불량·파손')`,[id(n),id(order),kind,status]);
  const g=(await get('blendpick'))[3];assert.equal(g.total,2);assert.equal(new Set(g.items.map(x=>x.id)).size,2);
  for(const x of g.items){assert.match(x.detail,/상품 불량/);const u=new URL(x.href,'https://preview.invalid');assert.equal(u.searchParams.get('requestId'),x.id);assert.equal(u.searchParams.get('tab'),x.id===id(30)?'return_requested':'exchange_requested')}
 });
 await test('counts remain total when display is capped; deterministic oldest-first order',async()=>{
  for(let n=100;n<132;n++)await db.query(`INSERT INTO orders(id,site,order_number,status,paid_at) VALUES($1,'blendpick',$2,'paid','2020-01-01')`,[id(n),'OLD-'+n]);
  const g=(await get('blendpick'))[0];assert.equal(g.total,35);assert.equal(g.items.length,30);assert.equal(g.items[0].id,id(100));
 });
 const auth={...mocks,'next/headers':{cookies:async()=>({get:()=>({value:'test'})})},'@/lib/auth':{verifyAdminToken:async()=>({name:'test'})},'@/lib/admin-site':{currentAdminSite:async()=>({key:'blendpick'}),adminOrderIdsBelong:async(ids,site)=>(await db.query('SELECT id FROM orders WHERE id=$1 AND site=$2',[ids[0],site])).rows.length>0}};
 const patch=load('app/api/admin/orders/[id]/route.ts',auth).PATCH;
 const request=(n,body)=>patch(new Request('https://preview.invalid',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:id(n)})});
 await test('repair only updates missing tracking; preserves status/time and invokes no external service',async()=>{
  const old=global.fetch;global.fetch=()=>{throw Error('External call forbidden')};
  try{const before=(await db.query('SELECT * FROM orders WHERE id=$1',[id(11)])).rows[0];
   assert.equal((await request(11,{action:'repair_tracking',tracking_company:' 04 ',tracking_number:' 12345 '})).status,200);
   const after=(await db.query('SELECT * FROM orders WHERE id=$1',[id(11)])).rows[0];assert.equal(after.status,before.status);assert.equal(+after.shipped_at,+before.shipped_at);assert.equal(after.tracking_number,'12345');
   assert.equal((await get('blendpick'))[1].total,2);
  }finally{global.fetch=old}
 });
 await test('repair rejects stale/full tracking, non-shipped, cross-site and invalid input',async()=>{
  const body={action:'repair_tracking',tracking_company:'04',tracking_number:'111'};
  assert.equal((await request(11,body)).status,409);assert.equal((await request(1,body)).status,409);assert.equal((await request(6,body)).status,404);
  assert.equal((await request(10,{...body,tracking_number:' '})).status,400);
 });
 await test('unauthenticated repair never reaches database or site lookup',async()=>{
  let calls=0;const p=load('app/api/admin/orders/[id]/route.ts',{...auth,'@/lib/auth':{verifyAdminToken:async()=>null},'@/lib/db-shop':{query:()=>{calls++;throw Error('blocked')}}}).PATCH;
  assert.equal((await p(new Request('https://preview.invalid',{method:'PATCH',body:'{}'}),{params:Promise.resolve({id:id(10)})})).status,401);assert.equal(calls,0);
 });
 await test('operations page rejects missing and invalid admin sessions before reading any data',async()=>{
  for(const token of [undefined,{value:'invalid'}]){
   let queries=0;
   const page=load('app/admin/(protected)/operations/page.tsx',{
    'next/headers':{cookies:async()=>({get:()=>token})},
    'next/navigation':{redirect:()=>{throw Error('LOGIN_REDIRECT')}},
    '@/lib/auth':{verifyAdminToken:async()=>null},
    '@/lib/admin-site':{currentAdminSite:async()=>{queries++;throw Error('Must authorize first')}},
    '@/lib/operations':{getTodayWork:async()=>{queries++;throw Error('Must authorize first')}}
   }).default;
   await assert.rejects(page(),/LOGIN_REDIRECT/);assert.equal(queries,0);
  }
 });
 await test('request-specific return lookup retains site constraint before LIMIT and rejects malformed IDs',async()=>{
  let seen;const route=load('app/api/admin/returns/route.ts',{...auth,'@/lib/sms':{},'@/lib/return-notify':{},'@/lib/db-shop':{query:async(sql,params)=>{seen={sql,params};return {rows:[]}}}}).GET;
  assert.equal((await route(new Request(`https://preview.invalid?kind=return&id=${id(30)}`))).status,200);
  assert.deepEqual(seen.params,['return',['requested','collecting'],'blendpick',id(30)]);assert.match(seen.sql,/o.site = \$3\s+AND r.id = \$4::uuid/);assert.ok(seen.sql.indexOf('r.id = $4')<seen.sql.indexOf('LIMIT'));
  seen=null;assert.equal((await route(new Request('https://preview.invalid?kind=return&id=bad'))).status,400);assert.equal(seen,null);
 });
 await test('rendered rows expose specific actions, resolution criteria and honest timestamps',async()=>{
  const groups=await get('blendpick');const C=load('components/admin/TodayWork.tsx').default;const html=render(React.createElement(C,{groups,siteName:'블랜드픽',updatedAt:'예시'}));
  for(const text of ['다음 행동','목록에서 빠지는 기준','누락 송장 입력','반품 신청 검토','출고 시각 미기록','35건 중 30건'])assert.ok(html.includes(text),text);
  const elapsed=load('lib/operations.ts',mocks).workElapsed;assert.equal(elapsed(null,'출고'),'출고 시각 미기록');assert.equal(elapsed(-1,'결제'),'결제 시각 확인 필요');assert.equal(elapsed(0.5,'신청'),'신청 후 1시간 미만');
 });
 console.log(`${count} tests passed; isolated data only.`);await db.close();
})().catch(async e=>{console.error(e);await db.close();process.exitCode=1});
