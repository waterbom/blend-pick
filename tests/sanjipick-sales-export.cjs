const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {load}=require('./support/load.cjs');
const id='00000000-0000-4000-8000-000000000001';

function setup({loggedIn=true,site='sanjipick'}={}){
 const accesses=[];
 const data={
  '@/lib/db-shop':{query:async(sql,args)=>{
   accesses.push([sql,args]);
   if(sql.includes('COUNT(*)::int AS orders'))return {rows:[{orders:1,gross:'12000',shipping:'3000',paid_shipping_orders:1,refunds:'2000',unresolved:0}]};
   if(sql.includes('FROM products_shop'))return {rows:[{id,name:'제철 사과',product_code:'P001',category:'산지픽 농산물',sale_type:'groupbuy',is_visible:false,archived_at:'2026-10-30T00:00:00Z'}]};
   if(sql.includes('DISTINCT ON'))return {rows:[{id,product_name:'제철 사과'}]};
   throw Error('Unexpected query');
  }},
  'next/headers':{cookies:async()=>({get:()=>loggedIn?{value:'token'}:undefined})},
  '@/lib/auth':{verifyAdminToken:async()=>loggedIn?{id:'admin'}:null},
  '@/lib/admin-site':{currentAdminSite:async()=>({key:site})},
  '@/lib/product-sales':{emptySalesCounts:()=>({paid:0,cancelled:0,returned:0,sold:0,orders:0,review:0,pending:0}),
   getProductSales:async()=>new Map([[id,{paid:2,cancelled:0,returned:0,sold:2,orders:1,review:0,pending:0,
     options:[{key:'standard',label:'2kg',paid:2,cancelled:0,returned:0,sold:2,orders:1,review:0,pending:0}]}]])},
  '@/lib/product-financials':{getProductFinancials:async(site,from,to,productId,db,details)=>{
    assert.equal(site,'sanjipick');assert.equal(from,'2026-09-01');assert.equal(to,'2026-11-06');assert.equal(details,true);
    return new Map([[id,{gross:12000,refunds:2000,net:10000,shipping:3000,shippingPayments:1,orders:1,units:2,
       displayOrders:0,nonDisplayOrders:1,review:0,allocatedOrders:0,estimatedOrders:0,
       orderRows:[{id:'o',orderNumber:'TEST-ONE',paidAt:'2026-11-06T01:15:00Z',status:'paid',channel:'non_display',
       units:2,gross:12000,refunds:2000,shipping:3000,shippingPaid:true,estimated:false,review:false}]}]]);
  }},
  '@/lib/order-finance':{validDateRange:(from,to)=>!from||!to||from<=to&&/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to)},
 };
 return {GET:load('app/api/admin/product-sales/export/route.ts',data).GET,accesses};
}
const req=(suffix='')=>new Request('https://sanjipick.blendpunch.com/api/admin/product-sales/export?from=2026-09-01&to=2026-11-06'+suffix);

test('sale workbook is private, readable, and includes product and order details',async()=>{
 const {GET,accesses}=setup();
 const res=await GET(req());
 assert.equal(res.status,200);
 assert.match(res.headers.get('content-disposition'),/sanjipick-sales-2026-09-01_to_2026-11-06\.xlsx/);
 assert.match(res.headers.get('cache-control'),/private/);
 const b=Buffer.from(await res.arrayBuffer());
 assert.equal(b.toString('utf8',0,2),'PK');
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(b);
 assert.ok(book.getWorksheet('전체 요약'));
 assert.ok(book.getWorksheet('상품별 실적'));
 assert.ok(book.getWorksheet('주문별 상세'));
 assert.ok(book.getWorksheet('옵션별 수량'));
 assert.equal(book.getWorksheet('상품별 실적').getCell('B2').value,'제철 사과');
 assert.equal(book.getWorksheet('주문별 상세').getCell('B2').value,'TEST-ONE');
 assert.ok(accesses.length>=3);
});
test('foreign domain and guests are forbidden before any financial query',async()=>{
 for(const spec of [{loggedIn:false},{site:'blendpick'}]){
  const {GET,accesses}=setup(spec);
  const response=await GET(req());
  assert.equal(response.status,spec.loggedIn===false?401:404);
  assert.equal(accesses.length,0);
 }
});
test('invalid date range is refused and never queries the database',async()=>{
 const {GET,accesses}=setup();
 const response=await GET(new Request('https://sanjipick.blendpunch.com/api/admin/product-sales/export?from=2026-11-07&to=2026-11-06'));
 assert.equal(response.status,400);
 assert.equal(accesses.length,0);
});
