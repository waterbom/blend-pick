const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const {shippingExceptions,trackingRows,trackingRowIssues}=load('lib/shipping-flow.ts');
const {dispatchLineNumbers,dispatchOrderBase}=load('lib/dispatch-number.ts');
const {normalizeImportRows,reviewImport}=load('lib/tracking-import.ts');
const {CORE_CARRIERS}=load('lib/carriers.ts');
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
 assert.deepEqual(trackingRows([['송장번호','비고','택배사','주문번호'],['001234','메모','CJ대한통운','BP1']]),[{order_number:'BP1',tracking_number:'001234',carrier_raw:'CJ대한통운',source_row:2}]);
 assert.deepEqual(trackingRows([['BP1','001234']]),[{order_number:'BP1',tracking_number:'001234',carrier_raw:undefined,source_row:1}]);
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
 assert.deepEqual(rows,[{order_number:'BP1',tracking_number:'001234',carrier_raw:undefined,source_row:2}]);
});
test('CSV rejects unclosed and misplaced quotes instead of guessing columns',()=>{
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\n"BP1,123'),/닫히지/);
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\n"BP1"x,123'),/인용부호/);
 assert.throws(()=>parseTrackingCSV('주문번호,운송장번호\nBP"1,123'),/인용부호/);
});
test('dispatch numbers are unique per item and stable across reorder and repeated downloads',()=>{
 const items=[{id:'item-b'},{id:'item-a'},{id:'item-c'}];
 const numbers=dispatchLineNumbers('SJ-20261102-ABC',items);
 assert.deepEqual(numbers,['SJ-20261102-ABC-L002','SJ-20261102-ABC-L001','SJ-20261102-ABC-L003']);
 assert.equal(new Set(numbers).size,items.length);
 assert.deepEqual(dispatchLineNumbers('SJ-20261102-ABC',items),numbers);
 assert.deepEqual(dispatchLineNumbers('SJ-20261102-ABC',[items[2],items[0],items[1]]),[numbers[2],numbers[0],numbers[1]]);
 assert.equal(dispatchLineNumbers('SJ-20261103-ABC',[items[0]])[0],'SJ-20261103-ABC-L001');
 assert.deepEqual(dispatchLineNumbers('OLD',[{},{}]),['OLD-L001','OLD-L002']);
 for(const number of ['SJ-ABC','SJ-ABC-L000','SJ-ABC-L01','SJ-ABC-1'])assert.equal(dispatchOrderBase(number),number);
 assert.equal(dispatchOrderBase('SJ-ABC-L001'),'SJ-ABC');
 assert.equal(dispatchOrderBase('SJ-ABC-L1000'),'SJ-ABC');
});
test('supplier line numbers resolve alone, deduplicate matching invoices and block conflicting shipments',()=>{
 const order={id:'o1',order_number:'SJ-ABC',status:'preparing',pending_refunds:false,tracking_company:null,tracking_number:null};
 const make=(number,tracking='001234')=>({order_number:number,tracking_number:tracking,carrier_raw:'CJ대한통운'});
 const review=rows=>reviewImport(normalizeImportRows(rows,null,CORE_CARRIERS),[order],CORE_CARRIERS);
 const alone=review([make('SJ-ABC-L002')]);
 assert.equal(alone.counts.ready,1);assert.equal(alone.rows[0].resolved_order,'SJ-ABC');
 assert.deepEqual(review([make('SJ-ABC-L001'),make('SJ-ABC-L002')]).counts,{total:2,ready:1,already:0,duplicate:1,blocked:0});
 assert.equal(review([make('SJ-ABC-L001'),make('SJ-ABC-L002','777888')]).counts.blocked,2);
 assert.equal(review([make('SJ-ABC-L001'),make('SJ-ABC-L002','')]).counts.blocked,2);
 assert.equal(review([make('MISSING-L001')]).counts.blocked,1);
 assert.equal(review([make('SJ-ABC-1')]).counts.blocked,1);
 const exact={...order,id:'o2',order_number:'SJ-ABC-L001'};
 assert.equal(reviewImport(normalizeImportRows([make(exact.order_number)],null,CORE_CARRIERS),[order,exact],CORE_CARRIERS).rows[0].order_id,'o2');
 for(const state of [{status:'cancelled'},{pending_refunds:true}])assert.equal(reviewImport(normalizeImportRows([make('SJ-ABC-L001')],null,CORE_CARRIERS),[{...order,...state}],CORE_CARRIERS).counts.blocked,1);
});

