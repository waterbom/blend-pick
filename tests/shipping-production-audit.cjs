const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {load}=require('./support/load.cjs');
const {orderImportState,reviewImport,CORE_CARRIERS}=load('lib/tracking-import.ts');
const {dispatchIssues}=load('lib/admin-workflow.ts');
const file=p=>fs.readFileSync(p,'utf8');
test('dispatch rejects unpaid, bad address and refund in progress before preparing',()=>{
 const base={status:'paid',paid_at:new Date().toISOString(),payment_key:'test-real',recipient_name:'A',recipient_phone:'010-1234-5678',addr_zipcode:'12345',addr_address:'주소',items:[{product_name:'상품',quantity:2}]};
 assert.deepEqual(dispatchIssues(base),[]);
 for(const patch of [{pending_refunds:true},{payment_key:null},{addr_address:''},{items:[]}])
  assert.ok(dispatchIssues({...base,...patch}).length>0);
});
test('shipment preview blocks cancelled, refunding and already shipped wrong tracking',()=>{
 const row={order_number:'ORD-1',tracking_number:'001234567890',carrier:'04',carrier_raw:'04',source_row:1,source_sheet:''};
 const base={id:'id1',order_number:'ORD-1',status:'preparing',pending_refunds:false,tracking_company:null,tracking_number:null};
 const carriers=[{code:'04',name:'CJ대한통운'}];
 assert.equal(orderImportState(base,row,carriers).result,'ready');
 assert.equal(orderImportState({...base,status:'cancelled'},row,carriers).result,'blocked');
 assert.equal(orderImportState({...base,pending_refunds:true},row,carriers).result,'blocked');
 assert.equal(orderImportState({...base,status:'shipped',tracking_company:'04',tracking_number:'9999999999'},row,carriers).result,'blocked');
});
test('shipment direct PATCH cannot transition without a shipment tracking number',()=>{
 const source=file('app/api/admin/orders/[id]/route.ts');
 assert.match(source,/status === 'shipped' && \(!tracking_company \|\| !tracking_number\)/);
 assert.match(source,/registerShipment\(client/);
});
test('automatic delivery settles valid orders separately with savepoint on each order',()=>{
 const source=file('scripts/auto-track-shipments.cjs');
 assert.match(source,/for \(const id of deliveredIds\)/);
 assert.match(source,/SAVEPOINT shipment_delivery/);
 assert.match(source,/ROLLBACK TO SAVEPOINT shipment_delivery/);
 assert.match(source,/recordDeliverySettlement\(client,order\)/);
});
