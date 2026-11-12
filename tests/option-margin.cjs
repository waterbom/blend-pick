const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./support/load.cjs');
const price=load('lib/option-margin.ts');
const blocked={query:()=>{throw Error('Production database blocked in isolated tests')}};
const {summarizeProductFinancials}=load('lib/product-financials.ts',{'@/lib/db-shop':blocked});
const line=(id,product,qty,price,cost,extra={})=>({
  id,product_id:product,product_ref:product,product_name:'테스트상품',quantity:qty,unit_price:price,supply_price:cost,...extra,
});
const order=(items,override={})=>({
  id:'order-1',order_number:'TEST-SNAPSHOT',paid_at:'2026-11-11T02:00:00Z',status:'paid',
  sales_channel:'display',total_amount:63000,shipping_fee:3000,refund_amount_unresolved:false,
  pending_refunds:false,items,refund_rows:[],return_rows:[],...override
});
test('single option displays supplier markup percent and exact won margin, not sales margin',()=>{
  const v=price.calculateUnitMargin('30000','20000');
  assert.equal(v.amount,10000);
  assert.equal(v.supplyMarkupPercent,50);
  assert.equal(v.salesMarginPercent,10000/30000*100);
  assert.match(price.unitMarginLabel(v),/10,000원/);
  assert.match(price.unitMarginLabel(v),/50.0%/);
});
test('missing or zero supply does not invent markup rate',()=>{
  for(const invalid of ['',null,undefined,'-1','abc','1.5']){
    assert.equal(price.calculateUnitMargin('30000',invalid),null);
  }
  assert.equal(price.calculateUnitMargin(30000,0).amount,30000);
  assert.equal(price.calculateUnitMargin(30000,0).supplyMarkupPercent,null);
  assert.match(price.unitMarginLabel(price.calculateUnitMargin(30000,0)),/산정 불가/);
  assert.equal(price.calculateUnitMargin(1000,2000).amount,-1000);
  assert.equal(price.calculateUnitMargin(0,100).salesMarginPercent,null);
});
test('product margin uses captured supply cost and excludes allocated delivery',()=>{
  const summary=summarizeProductFinancials([
    order([line('i1','p1',2,30000,20000)])
  ],true).get('p1');
  assert.equal(summary.gross,63000);
  assert.equal(summary.shipping,3000);
  assert.equal(summary.supplyCost,40000);
  assert.equal(summary.grossMargin,20000);
  assert.equal(summary.orderRows[0].grossMargin,20000);
  assert.equal(summary.marginReviewOrders,0);
});
test('multiple items are attributed individually, add-on costs do not inflate main product margin',()=>{
  const rows=[line('i1','p1',1,30000,20000),line('i2','p2',1,20000,14000),
    line('i3',null,1,10000,null,{product_ref:'p1',product_name:'[추가] 사은품'})];
  const summary=summarizeProductFinancials([order(rows)],true);
  assert.equal(summary.get('p1').grossMargin,10000);
  assert.equal(summary.get('p1').supplyCost,20000);
  assert.equal(summary.get('p2').grossMargin,6000);
  assert.equal(summary.get('p2').supplyCost,14000);
  assert.equal(summary.get('p1').marginReviewOrders,0);
});
test('refunds and cancelled items retain historical pre-refund margin but flag unknown realized profit',()=>{
  const o=order([line('i1','p1',2,30000,20000)],{
    status:'cancelled',refund_rows:[{source_key:'cancel:order-1',amount:63000}],
  });
  const row=summarizeProductFinancials([o],true).get('p1');
  assert.equal(row.grossMargin,20000);
  assert.equal(row.marginReviewOrders,1);
  assert.equal(row.orderRows[0].marginReview,true);
});
test('historic missing supply never turns into a misleading zero-cost profit',()=>{
  const row=summarizeProductFinancials([order([line('i1','p1',2,30000,null)])],true).get('p1');
  assert.equal(row.supplyCost,null);
  assert.equal(row.grossMargin,null);
  assert.equal(row.orderRows[0].grossMargin,null);
});
test('both storefronts show won and supplier percentage without applying a markup to option unit price',()=>{
  const form=fs.readFileSync('components/admin/ProductFormClient.tsx','utf8');
  assert.match(form,/개당 마진금액/);
  assert.match(form,/공급가 대비 \(%\)/);
  assert.match(form,/MarginCells price=\{opt.price\}/);
  assert.match(form,/MarginCells price=\{ad.price\}/);
  assert.match(form,/unitMarginLabel\(calculateUnitMargin\(o.linkPrice/);
  assert.match(fs.readFileSync('lib/order-amount.ts','utf8'),/supplyPrice: opt\?\.supply_price \?\? prod\.supply_price/);
});
