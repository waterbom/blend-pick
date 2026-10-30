const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');

const { adminGroups, adminPrimaryLinks, adminLocation } = load('lib/admin-navigation.ts');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const product = (n, extra={}) => ({
  id:id(n),name:n===1?'제철 사과':'비전시 감자',brand:'산지농가',category:'산지픽 농산물',
  product_code:'P00'+n,sale_type:'groupbuy',
  sale_start_at:'2026-10-01T00:00:00Z',sale_end_at:'2026-10-20T00:00:00Z',
  status:'active',stock:10,is_visible:n===1,archived_at:n===1?null:'2026-10-25T00:00:00Z',...extra
});
const money=(gross,refund=0) => ({
  gross,refunds:refund,net:gross-refund,shipping:3000,shippingPayments:1,orders:2,units:3,
  displayOrders:1,nonDisplayOrders:1,review:0,allocatedOrders:0,estimatedOrders:0,orderRows:[]
});
const counts=()=>({paid:3,cancelled:0,returned:0,sold:3,orders:2,review:0,pending:0,options:[]});
async function render({site='sanjipick',searchParams={},products=[product(1),product(2)],fail=false,auth=true}={}){
  let called=0,financialCalls=[],saleCalls=[],sql='';
  const mocks={
    'next/headers':{cookies:async()=>({get:()=>auth?{value:'ok'}:undefined})},
    'next/navigation':{redirect:()=>{throw Error('REDIRECT');},notFound:()=>{throw Error('NOT_FOUND');}},
    'next/link':({children,prefetch,...props})=>React.createElement('a',props,children),
    '@/lib/auth':{verifyAdminToken:async()=>auth?{id:'admin'}:null},
    '@/lib/admin-site':{
      currentAdminSite:async()=>({key:site}),
      adminProductScopeSql:(key,column,index)=>({sql:column+' = ANY($'+index+'::text[])',param:['산지픽 농산물']}),
    },
    '@/lib/db-shop':{query:async(query,args)=>{called++;sql=String(query);assert.deepEqual(args,[['산지픽 농산물']]);if(fail)throw Error('isolated DB failure');return{rows:products};}},
    '@/lib/product-sales':{getProductSales:async(...a)=>{saleCalls.push(a);return new Map([[id(1),counts()],[id(2),counts()]])},emptySalesCounts:()=>({paid:0,cancelled:0,returned:0,sold:0,orders:0,review:0,pending:0})},
    '@/lib/product-financials':{getProductFinancials:async(...a)=>{financialCalls.push(a);return new Map([[id(1),money(80000,5000)],[id(2),money(35000)]])},
      emptyProductMoney:()=>({gross:0,refunds:0,net:0,shipping:0,shippingPayments:0,orders:0,units:0,displayOrders:0,nonDisplayOrders:0,review:0,allocatedOrders:0,estimatedOrders:0,orderRows:[]})},
    '@/lib/order-finance':{validDateRange:(from,to)=>!from||!to||from<=to},
  };
  const Page=load('app/admin/(protected)/product-sales/page.tsx',mocks).default;
  const output=await Page({searchParams:Promise.resolve(searchParams)});
  return {html:renderToStaticMarkup(output),called,saleCalls,financialCalls,sql};
}
test('Sanjipick alone gets dedicated sales menu and Blendpick navigation is untouched',()=>{
  const path='/admin/product-sales';
  assert.ok(adminPrimaryLinks('sanjipick').some(i=>i.href===path&&i.label==='상품별 판매실적'));
  assert.ok(adminGroups('sanjipick').flatMap(g=>g.items).some(i=>i.href===path));
  assert.ok(!adminGroups('blendpick').flatMap(g=>g.items).some(i=>i.href===path));
  assert.equal(adminLocation(path,'sanjipick').label,'상품별 판매실적');
});
test('Sanjipick report includes archived, finished and non-display product revenue by default',async()=>{
  const {html,saleCalls,financialCalls,sql}=await render({searchParams:{from:'2026-10-01',to:'2026-10-30'}});
  assert.match(html,/상품별 판매실적/);
  assert.match(html,/제철 사과/);
  assert.match(html,/비전시 감자/);
  assert.match(html,/현재 비전시/);
  assert.match(html,/115,000원/);
  assert.match(html,/5,000원/);
  assert.match(html,/10월/); // HTML table contains dates from October
  assert.match(html,/전시·비전시 전체/);
  assert.match(html,/admin\/products\/00000000-0000-4000-8000-000000000002\/sales\?from=2026-10-01&amp;to=2026-10-30/);
  assert.equal(saleCalls.length,1);
  assert.deepEqual(saleCalls[0],['sanjipick','2026-10-01','2026-10-30']);
  assert.deepEqual(financialCalls[0],['sanjipick','2026-10-01','2026-10-30']);
  assert.ok(!sql.includes('archived_at IS NULL'));
});
test('current non-display filter keeps archived product while past purchase channel remains visible',async()=>{
  const {html}=await render({searchParams:{from:'2026-10-01',to:'2026-10-30',visibility:'hidden'}});
  assert.doesNotMatch(html,/제철 사과/);
  assert.match(html,/비전시 감자/);
  assert.match(html,/비전시 1건/);
});
test('invalid reporting range rejects finance queries instead of silently showing all-time amounts',async()=>{
  const {html,called,saleCalls,financialCalls}=await render({searchParams:{from:'2026-10-31',to:'2026-10-01'}});
  assert.match(html,/조회 날짜를 확인/);
  assert.equal(called,0);
  assert.equal(saleCalls.length,0);
  assert.equal(financialCalls.length,0);
});
test('report load failure does not masquerade as zero revenue',async()=>{
  const {html}=await render({fail:true,searchParams:{from:'2026-10-01',to:'2026-10-30'}});
  assert.match(html,/판매실적을 불러오지 못했습니다/);
  assert.doesNotMatch(html,/0원/);
});
test('Blendpick direct path and unauthenticated requests never read Sanjipick figures',async()=>{
  await assert.rejects(render({site:'blendpick'}),/NOT_FOUND/);
  await assert.rejects(render({auth:false}),/REDIRECT/);
});
