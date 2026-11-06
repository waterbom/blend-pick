const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {load}=require('./support/load.cjs');

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const total={orders:1,gross:'23000',refunds:'3000',shipping:'3000',shipping_payments:1,review:0};
function sales() {
  return new Map([[id(1),{
    paid:2,cancelled:1,returned:0,sold:1,orders:1,review:0,pending:0,
    options:[{key:'red',label:'사과 3kg',paid:2,cancelled:1,returned:0,sold:1,orders:1,review:0,pending:0}],
  }],[id(2),{paid:1,cancelled:0,returned:0,sold:1,orders:1,review:0,pending:0,options:[]}]]);
}
function financials(){
  const base={shippingPayments:1,orders:1,units:1,displayOrders:0,nonDisplayOrders:1,review:0,allocatedOrders:1,estimatedOrders:1};
  return new Map([
    [id(1),{...base,gross:15000,refunds:3000,net:12000,shipping:1800,orderRows:[
      {id:id(10),orderNumber:'SJ20261106-1',paidAt:'2026-11-01T01:00:00Z',status:'paid',channel:'non_display',units:2,gross:15000,refunds:3000,shipping:1800,shippingPaid:true,estimated:true,review:false}
    ]}],
    [id(2),{...base,gross:8000,refunds:0,net:8000,shipping:1200,orderRows:[
      {id:id(10),orderNumber:'SJ20261106-1',paidAt:'2026-11-01T01:00:00Z',status:'paid',channel:'non_display',units:1,gross:8000,refunds:0,shipping:1200,shippingPaid:true,estimated:true,review:false}
    ]}],
  ]);
}
function harness({site='sanjipick',auth=true,fail=false}={}){
 let connected=0,closed=0,queries=[],salesCalls=[],moneyCalls=[];
 const client={
   async query(sql,args){queries.push([sql,args]); if(fail)throw Error('isolated db error');
     if(sql.startsWith('BEGIN')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
     if(sql.includes('GROUP BY to_char'))return {rows:[{month:'2026-11',...total}]};
     if(sql.includes('COUNT(*)::int AS orders')&&sql.includes('FROM orders o'))return {rows:[total]};
     if(sql.includes('FROM products_shop'))return {rows:[
       {id:id(1),name:'제철 사과',brand:'농가',category:'산지픽 농산물',product_code:'P001',sale_type:'groupbuy',sale_start_at:'2026-09-20T00:00:00Z',sale_end_at:'2026-10-05T00:00:00Z',status:'active',is_visible:false,archived_at:null},
     ]};
     if(sql.includes('DISTINCT ON'))return {rows:[{product_id:id(1),product_name:'제철 사과'},{product_id:id(2),product_name:'단종된 사과'}]};
     throw Error('unexpected query '+sql.slice(0,80));
   },
   release(){closed++;},
 };
 const mocks={
   '@/lib/db-shop':{connect:async()=>{connected++;return client;}},
   'next/headers':{cookies:async()=>({get:()=>auth?{value:'session'}:null})},
   '@/lib/auth':{verifyAdminToken:async()=>auth?{id:'admin'}:null},
   '@/lib/admin-site':{currentAdminSite:async()=>({key:site}),adminProductScopeSql:()=>({sql:'category = ANY($1::text[])',param:['산지픽 농산물']})},
   '@/lib/product-sales':{getProductSales:async(...args)=>{salesCalls.push(args);return sales();},emptySalesCounts:()=>({paid:0,cancelled:0,returned:0,sold:0,orders:0,review:0,pending:0})},
   '@/lib/product-financials':{getProductFinancials:async(...args)=>{moneyCalls.push(args);return financials();},emptyProductMoney:()=>({gross:0,refunds:0,net:0,shipping:0,shippingPayments:0,orders:0,units:0,displayOrders:0,nonDisplayOrders:0,review:0,allocatedOrders:0,estimatedOrders:0,orderRows:[]})},
 };
 const module=load('app/api/admin/product-sales/export/route.ts',mocks);
 const run=(q='from=2026-09-01&to=2026-11-06')=>module.GET(new Request('https://sanjipick.blendpunch.com/api/admin/product-sales/export?'+q));
 return{run,stats:()=>({connected,closed,queries,salesCalls,moneyCalls})};
}
test('Sanjipick authenticated export returns real workbook structure with no customer PII',async()=>{
 const h=harness();
 const response=await h.run();
 assert.equal(response.status,200);
 assert.match(response.headers.get('Content-Type'),/spreadsheetml/);
 assert.match(response.headers.get('content-disposition'),/sanjipick_sales_2026-09-01_2026-11-06.xlsx/);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
 assert.deepEqual(book.worksheets.map(x=>x.name),['집계요약','월별합계','상품별실적','옵션별수량','주문별상세']);
 assert.equal(book.getWorksheet('집계요약').getCell('B5').value,1);
 assert.equal(book.getWorksheet('집계요약').getCell('B6').value,23000);
 const rows=book.getWorksheet('상품별실적');
 assert.equal(rows.getCell('B5').value,'제철 사과');
 assert.equal(rows.getCell('B6').value,'단종된 사과');
 assert.equal(rows.getCell('O5').value,15000);
 assert.equal(rows.getCell('Q5').value.result,12000);
 assert.equal(rows.getCell('R5').value,1);
 assert.equal(book.getWorksheet('옵션별수량').getCell('C5').value,'사과 3kg');
 const details=book.getWorksheet('주문별상세');
 assert.equal(details.getCell('D5').value,'SJ20261106-1');
 assert.equal(details.getCell('F5').value,'비전시');
 assert.equal(details.getCell('K5').value,1);
 assert.match(details.getCell('O5').value,/https:\/\/sanjipick.blendpunch.com\/admin\/orders\//);
 const serialized=JSON.stringify(book.worksheets.map(x=>x.getSheetValues()));
 assert.doesNotMatch(serialized,/010-1234|buyer_phone|recipient_name|payment_key/);
 const stats=h.stats();
 assert.equal(stats.connected,1);assert.equal(stats.closed,1);
 assert.ok(stats.queries[0][0].includes('READ ONLY'));
 assert.ok(!stats.queries.some(([sql])=>/^\s*(UPDATE|INSERT|DELETE)\b/i.test(sql)));
 assert.deepEqual(stats.salesCalls[0].slice(0,3),['sanjipick','2026-09-01','2026-11-06']);
 assert.equal(stats.moneyCalls[0][5],true);
});
test('missing admin session and Blendpick host cannot access Sanjipick sales export',async()=>{
 for(const x of [{auth:false,code:401},{site:'blendpick',code:404}]){
   const h=harness(x);const response=await h.run();
   assert.equal(response.status,x.code);assert.equal(h.stats().connected,0);
 }
});
test('duplicate dates, invalid dates and excessive range return 400 without touching DB',async()=>{
 for(const q of ['from=2026-09-01&from=2026-09-02&to=2026-11-06',
 'from=2026-11-07&to=2026-11-06','from=2026-02-30&to=2026-11-06',
 'from=2025-01-01&to=2026-11-06']){
  const h=harness();const r=await h.run(q);assert.equal(r.status,400);assert.equal(h.stats().connected,0);
 }
});
test('DB error returns 503 and releases read-only connection after rollback',async()=>{
 const h=harness({fail:true});const r=await h.run();
 assert.equal(r.status,503);
 assert.equal(h.stats().closed,1);
 assert.ok(h.stats().queries.some(([sql])=>sql==='ROLLBACK'));
});
