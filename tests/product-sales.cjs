const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db, serial = 100;
const blocked = { query: () => { throw Error('Production database access blocked'); } };
const salesLib = load('lib/product-sales.ts', { '@/lib/db-shop': blocked });
test.before(async () => {
  db = new PGlite();
  await require('./support/integrity-schema.cjs')(db, id);
  await db.exec('ALTER TABLE order_returns ADD COLUMN items jsonb');
});
test.after(async () => db.close());
test.beforeEach(async () => {
  await db.exec('TRUNCATE order_items, order_returns, orders CASCADE');
});
async function order({ site='blendpick', status='paid', paid='2026-09-28T02:00:00Z', key='real-payment', type='shop', items=[{product:1,qty:1}], unresolved=false } = {}) {
  const oid = id(++serial);
  await db.query('INSERT INTO orders(id,site,status,paid_at,payment_key,order_type,total_amount,refund_amount_unresolved) VALUES($1,$2,$3,$4,$5,$6,100000,$7)', [oid,site,status,paid,key,type,unresolved]);
  const lines=[];
  for (const item of items) {
    const iid=id(++serial); lines.push(iid);
    await db.query('INSERT INTO order_items(id,order_id,product_id,product_ref,option_id,option_label,quantity,product_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[iid,oid,item.product?id(item.product):null,item.ref?id(item.ref):null,item.option?id(item.option):null,item.label||null,item.qty,item.name||'테스트 상품']);
  }
  return {id:oid,lines};
}
async function returned(o, items, {kind='return', status='done', refund=true}={}) {
  const rid=id(++serial);
  await db.query('INSERT INTO order_returns(id,order_id,kind,status,items) VALUES($1,$2,$3,$4,$5)',[rid,o.id,kind,status,JSON.stringify(items)]);
  if(refund && kind==='return' && status==='done') await db.query('INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES($1,$2,1000)',['return:'+rid,o.id]);
  return rid;
}
const get = (site='blendpick',from,to) => salesLib.getProductSales(site,from,to,db);
test('real paid units, distinct orders, site scope, partial returns, pending returns and options',async()=>{
  await order({items:[{product:1,option:11,label:'빨강',qty:2},{product:1,option:12,label:'파랑',qty:3},{product:2,qty:1},{qty:99}]});
  await order({status:'cancelled',items:[{product:1,qty:4}]});
  const r=await order({status:'return_completed',items:[{product:1,qty:5}]});
  await returned(r,[{item_id:r.lines[0],quantity:2}]);
  await returned(r,[{item_id:r.lines[0],quantity:1000}],{kind:'exchange'});
  const pending=await order({status:'return_requested',items:[{product:1,qty:6}]});
  await returned(pending,[{item_id:pending.lines[0],quantity:6}],{status:'requested'});
  await order({site:'sanjipick',items:[{product:1,qty:100}]});
  for(const spec of [{key:'SIM_test'},{key:null},{key:''},{paid:null},{type:'hotel'},{status:'pending'}]) await order({...spec,items:[{product:1,qty:500}]});
  const sales=await get(),p=sales.get(id(1));
  assert.deepEqual([p.paid,p.cancelled,p.returned,p.sold,p.orders,p.review,p.pending],[20,4,2,14,4,0,1]);
  assert.equal(sales.size,2);assert.equal(sales.get(id(2)).sold,1);
  assert.equal(p.options.find(x=>x.label==='빨강').sold,2);
  assert.equal((await get('sanjipick')).get(id(1)).sold,100);
});
test('KST payment date includes both calendar boundaries and rejects invalid ranges',async()=>{
  for(const paid of ['2026-09-27T14:59:59Z','2026-09-27T15:00:00Z','2026-09-28T14:59:59.999Z','2026-09-28T15:00:00Z']) await order({paid});
  assert.equal((await get('blendpick','2026-09-28','2026-09-28')).get(id(1)).sold,2);
  assert.equal((await get('blendpick',undefined,'2026-09-28')).get(id(1)).sold,3);
  for(const range of [['2026-09-29','2026-09-28'],['2026-02-30',undefined],["' OR 1=1 --",undefined]]) await assert.rejects(get('blendpick',...range),/기간/);
});
test('snapshot product references remain attributable; add-ons never inflate sales',async()=>{
  await order({items:[{ref:3,qty:7},{qty:20},{ref:3,qty:30,name:'[추가] 손잡이'},{ref:3,qty:7,name:'[설치비] 테스트 상품'}]});
  const sales=await get();assert.equal(sales.size,1);assert.equal(sales.get(id(3)).sold,7);
});
test('returned add-ons do not reduce the parent product quantity',async()=>{
  const o=await order({status:'return_completed',items:[{product:1,ref:1,qty:3},{ref:1,name:'[추가] 포장',qty:2}]});
  await returned(o,[{item_id:o.lines[1],quantity:1}]);
  const p=(await get()).get(id(1));assert.equal(p.paid,3);assert.equal(p.sold,3);assert.equal(p.returned,0);assert.equal(p.review,0);
});
test('multiple option lines count one paid order, even when fully cancelled',async()=>{
  await order({status:'cancelled',items:[{product:1,option:11,qty:2},{product:1,option:11,qty:3}]});
  const p=(await get()).get(id(1));assert.equal(p.orders,1);assert.equal(p.options[0].orders,1);assert.equal(p.sold,0);assert.equal(p.cancelled,5);
});
test('return item identity is order-local and duplicate/overlarge quantities are flagged and capped',async()=>{
  const a=await order({items:[{product:1,qty:4}]});
  const b=await order({items:[{product:2,qty:6}]});
  await returned(a,[{item_id:a.lines[0],quantity:2},{item_id:a.lines[0],quantity:2},{item_id:b.lines[0],quantity:6}]);
  await returned(a,[{item_id:a.lines[0],quantity:20}]);
  const sales=await get();assert.equal(sales.get(id(1)).sold,0);assert.equal(sales.get(id(1)).returned,4);assert.equal(sales.get(id(1)).review,1);assert.equal(sales.get(id(2)).sold,6);
});
test('cancelled and returned units are never deducted twice',async()=>{
  const o=await order({status:'cancelled',items:[{product:1,qty:3}]});await returned(o,[{item_id:o.lines[0],quantity:2}]);
  const p=(await get()).get(id(1));assert.equal(p.cancelled,3);assert.equal(p.returned,0);assert.equal(p.sold,0);
});
test('legacy/unmapped refunds are provisional, never converted from money into units',async()=>{
  const o=await order({items:[{product:1,qty:8}]});
  await db.query('INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES($1,$2,1000)',['legacy:'+o.id,o.id]);
  let p=(await get()).get(id(1));assert.equal(p.sold,8);assert.equal(p.review,1);
  await order({status:'return_completed',items:[{product:1,qty:2}]});
  await order({unresolved:true,items:[{product:1,qty:3}]});
  p=(await get()).get(id(1));assert.equal(p.sold,13);assert.equal(p.review,3);
});
test('pending refund operations flag quantity review',async()=>{
  const o=await order();await db.query("INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,total,idempotency_key,status) VALUES($1,$2,100,0,'test',100000,$1,'processing')",['pending:'+o.id,o.id]);
  assert.equal((await get()).get(id(1)).review,1);
});
test('malformed historical return records do not break the page or become definitive units',async()=>{
  for(const items of [null,{},[],[{item_id:'missing',quantity:1}],[{quantity:-3}]]) {const o=await order({status:'return_completed'});await returned(o,items);}
  const p=(await get()).get(id(1));assert.equal(p.sold,5);assert.equal(p.review,5);
});
const Cell=load('components/admin/ProductSalesCell.tsx').default;
test('sales cell distinguishes zero, unavailable, provisional and option details',()=>{
  const render=sales=>renderToStaticMarkup(React.createElement(Cell,{sales}));
  assert.match(render(null),/집계 불가/);assert.doesNotMatch(render(null),/0개/);
  assert.match(render({...salesLib.emptySalesCounts(),options:[]}),/0개/);
  const s=salesLib.summarizeProductSales([{id:'o',status:'paid',pending_refunds:true,returns:[],items:[{id:'i',product_id:'p',quantity:3,option_label:'<테스트>'}]}]).get('p');
  const html=render(s);assert.match(html,/잠정/);assert.match(html,/옵션별·집계 내역/);assert.match(html,/&lt;테스트&gt;/);assert.match(html,/수량 확인 필요/);
});
async function page({filters={},fail=false}={}) {
  const calls=[];
  const Page=load('app/admin/(protected)/products/page.tsx',{
    '@/lib/db-shop':{query:async()=>({rows:[{id:id(1),name:'상품',status:'active',stock:5,price:1000,created_at:'2026-09-28'}]})},
    '@/lib/admin-site':{currentAdminSite:async()=>({key:'sanjipick'}),adminProductScopeSql:()=>({sql:'true',param:[]})},
    '@/lib/product-sales':{...salesLib,getProductSales:async(...args)=>{calls.push(args);if(fail)throw Error('isolated test failure');return new Map();}},
    '@/components/admin/ProductDeleteButton':()=>null,'@/components/admin/ProductCodeCopy':()=>null,'@/components/admin/SecretLinkCopy':()=>null,
  }).default;
  return {html:renderToStaticMarkup(await Page({searchParams:Promise.resolve(filters)})),calls};
}
test('product page passes host site and date filters, retains dates on tabs, shows zero and sales controls',async()=>{
  const {html,calls}=await page({filters:{from:'2026-09-01',to:'2026-09-28'}});
  assert.deepEqual(calls,[['sanjipick','2026-09-01','2026-09-28']]);assert.match(html,/상품별 판매량/);assert.match(html,/name="from"/);assert.match(html,/from=2026-09-01&amp;to=2026-09-28&amp;f=ready/);assert.match(html,/0개/);
});
test('invalid dates block only metrics and do not execute a misleading all-time query',async()=>{
  const {html,calls}=await page({filters:{from:'2026-09-29',to:'2026-09-01'}});
  assert.equal(calls.length,0);assert.match(html,/판매 집계 기간을 확인/);assert.match(html,/집계 불가/);
});
test('repeated date parameters are rejected rather than ignored',async()=>{
  const {html,calls}=await page({filters:{from:['2026-09-01','2026-09-02']}});
  assert.equal(calls.length,0);assert.match(html,/판매 집계 기간을 확인/);
});
test('lookup failure stays unavailable instead of silently reporting zero',async()=>{
  const {html}=await page({fail:true});assert.match(html,/판매량을 불러오지 못했습니다/);assert.match(html,/집계 불가/);
});
