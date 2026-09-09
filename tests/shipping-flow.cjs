const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const {shippingExceptions,trackingRows,trackingRowIssues}=load('lib/shipping-flow.ts');
const now=Date.parse('2026-09-09T15:10:00Z'); // KST September 10
const base={id:'example',status:'preparing',created_at:'2026-09-01',items:[]};
test('scheduled future shipments do not become overdue based on order age',()=>{
 assert.deepEqual(shippingExceptions({...base,items:[{quantity:1,expected_ship_date:'2026-09-11'}]},now),[]);
 assert.deepEqual(shippingExceptions({...base,items:[{quantity:1,expected_ship_date:'2026-09-09'}]},now),['출고 예정일 경과']);
 assert.deepEqual(shippingExceptions({...base,items:[{quantity:1,expected_ship_date:'2026-09-10'}]},now),[]);
});
test('missing plan, missing tracking and refund holds remain visible',()=>{
 assert.deepEqual(shippingExceptions(base,now),['출고 예정일 미지정']);
 assert.deepEqual(shippingExceptions({...base,status:'shipped',tracking_company:'04',tracking_number:' ',pending_refunds:true},now),['송장 정보 누락','환불 처리 중 · 출고 확인 필요']);
 assert.deepEqual(shippingExceptions({...base,status:'delivered'},now),[]);
});
test('supplier column order and leading zeros are preserved',()=>{
 assert.deepEqual(trackingRows([['송장번호','비고','택배사','주문번호'],['001234','메모','CJ대한통운','BP1']]),[{order_number:'BP1',tracking_number:'001234',carrier_raw:'CJ대한통운'}]);
 assert.deepEqual(trackingRows([['BP1','001234']]),[{order_number:'BP1',tracking_number:'001234',carrier_raw:undefined}]);
});
test('partial headers fail clearly; missing cells are not silently dropped',()=>{
 assert.throws(()=>trackingRows([['주문번호','메모']]),/모두 필요/);
 assert.equal(trackingRowIssues(trackingRows([['주문번호','운송장번호'],['BP1','']])).length,1);
});
test('duplicates and corrupted scientific notation are blocked before import',()=>{
 assert.equal(trackingRowIssues([{order_number:'BP1',tracking_number:'123'},{order_number:'BP1',tracking_number:'6.995E+11'}]).length,2);
 assert.deepEqual(trackingRowIssues([{order_number:'BP1',tracking_number:'001-234'}]),[]);
});
const {parseTrackingCSV}=load('lib/shipping-flow.ts');
test('CSV quoted comma, newline, escaped quote, BOM, CRLF and leading zero survive',()=>{
 const rows=parseTrackingCSV('\uFEFF메모,주문번호,운송장번호\r\n"상자,주의\n""파손""",BP1,001234\r\n');
 assert.deepEqual(rows,[{order_number:'BP1',tracking_number:'001234',carrier_raw:undefined}]);
});
test('CSV rejects unclosed and misplaced quotes instead of guessing columns',()=>{
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\n"BP1,123'),/닫히지/);
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\n"BP1"x,123'),/인용부호/);
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\nBP"1,123'),/인용부호/);
});
