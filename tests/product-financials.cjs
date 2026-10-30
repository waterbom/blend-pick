const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./support/load.cjs');
const blocked = { query: () => { throw Error('production database blocked'); } };
const {summarizeProductFinancials}=load('lib/product-financials.ts',{'@/lib/db-shop':blocked});
const line=(id,product,qty,price)=>({id,product_id:product,product_ref:product,product_name:'상품',quantity:qty,unit_price:price});
const order=(lines,extra={})=>({
 id:'order1',order_number:'TEST-1',paid_at:'2026-10-15T02:00:00Z',status:'paid',
 sales_channel:'display',total_amount:23000,shipping_fee:3000,refund_amount_unresolved:false,
 pending_refunds:false,items:lines,refund_rows:[],return_rows:[],...extra
});
test('two products share payment and delivery without multiplying order totals',()=>{
 const result=summarizeProductFinancials([order([line('i1','a',1,10000),line('i2','b',1,10000)])],true);
 assert.equal(result.get('a').gross,11500);
 assert.equal(result.get('b').gross,11500);
 assert.equal(result.get('a').shipping,1500);
 assert.equal(result.get('b').shipping,1500);
 assert.equal(result.get('a').shippingPayments,1);
 assert.equal([...result.values()].reduce((s,x)=>s+x.gross,0),23000);
 assert.equal(result.get('a').allocatedOrders,1);
});
test('single product counts one paid shipping transaction with multiple option lines',()=>{
 const result=summarizeProductFinancials([order([line('i1','a',1,10000),line('i2','a',1,10000)])],true);
 assert.deepEqual([result.get('a').orders,result.get('a').units,result.get('a').shippingPayments],[1,2,1]);
 assert.deepEqual([result.get('a').gross,result.get('a').shipping],[23000,3000]);
});
test('refund tied to a return is attributed to the returned product',()=>{
 const result=summarizeProductFinancials([order([line('i1','a',1,10000),line('i2','b',1,10000)],{
  refund_rows:[{source_key:'return:r1',amount:10000}],
  return_rows:[{id:'r1',kind:'return',status:'done',items:[{item_id:'i1',quantity:1}]}],
 })]);
 assert.deepEqual([result.get('a').refunds,result.get('b').refunds],[10000,0]);
});
test('unmapped refunds are allocated and flagged, unresolved refunds invalidate net',()=>{
 const result=summarizeProductFinancials([order([line('i1','a',1,10000),line('i2','b',1,10000)],{
  refund_rows:[{source_key:'legacy',amount:1000}],pending_refunds:true,sales_channel:'non_display'
 })]);
 assert.equal(result.get('a').refunds,500);
 assert.equal(result.get('b').refunds,500);
 assert.equal(result.get('a').net,null);
 assert.equal(result.get('a').nonDisplayOrders,1);
});
test('no order lines avoids invented attribution and ignores unrelated site data at query boundary',()=>{
 assert.equal(summarizeProductFinancials([order([])]).size,0);
});
