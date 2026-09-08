// Real route handlers + isolated PostgreSQL. PG/shipping calls are mocked; no production access.
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');const {NextRequest}=require('next/server');
const {load}=require('./support/load.cjs');const setup=require('./support/integrity-schema.cjs');
const db=new PGlite();let site='sanjipick',auth=true,hook=null,mutex=Promise.resolve();
const native=async(sql,p=[])=>{const r=await db.query(sql,p.map(v=>v instanceof Date?v.toISOString():v));return {...r,rowCount:r.affectedRows??r.rows.length};};
const query=(sql,p=[])=>hook?hook(sql,p,native):native(sql,p);
async function lock(){const prev=mutex;let release;mutex=new Promise(r=>release=r);await prev;return release;}
const pool={query:async(...args)=>{const release=await lock();try{return await query(...args);}finally{release();}},connect:async()=>{const release=await lock();return {query,release};}};
const mocks={'@/lib/db-shop':pool,'@/lib/db':{query:native},'next/headers':{cookies:async()=>({get:()=>auth?{value:'mock'}:undefined}),headers:async()=>new Headers({host:site==='sanjipick'?'sanjipick.blendpunch.com':'shop.blendpunch.com'})},'@/lib/auth':{verifyAdminToken:async()=>auth?{}:null,verifyToken:async()=>null},'@/lib/sms':{phoneVerifyOn:()=>false,smsConfigured:()=>false},'@/lib/phone-verify':{isPhoneVerified:async()=>false},'@/lib/inf-ref':{infRefFromCookie:()=>null}};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const req=(path='/x',method='GET',body)=>new NextRequest('https://'+(site==='sanjipick'?'sanjipick':'shop')+'.blendpunch.com'+path,{method,headers:{host:(site==='sanjipick'?'sanjipick':'shop')+'.blendpunch.com','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const api=path=>load('app/api/'+path+'/route.ts',mocks),ctx=n=>({params:Promise.resolve({id:id(n)})});
const originalFetch=global.fetch;
before(()=>setup(db,id));
beforeEach(async()=>{site='sanjipick';auth=true;hook=null;global.fetch=async()=>{throw Error('UNMOCKED NETWORK BLOCKED');};await db.exec('TRUNCATE payment_attempts,products_shop,product_options,product_addons,orders,order_items,settlements,campaign_costs,influencer_payouts,product_secret_links,order_refund_amounts,product_images,order_returns,order_return_events CASCADE');});
after(async()=>{global.fetch=originalFetch;await db.close();});
async function product(n=1,price=100000,stock=20){await query("INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,supply_price,influencer_rate,influencer_id,tax_type) VALUES($1,$2,'산지픽',$3,$4,'active',true,'free',0,20000,10,$5,'taxable')",[id(n),'상품'+n,price,stock,id(999)]);}
async function order(n=10,total=100000,status='paid',pid=1){await query("INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key,payment_method,influencer_id,influencer_name,commission_rate) VALUES($1,'sanjipick','shop',$2,NOW(),$3,$4,0,$5,'계좌이체',$6,'테스트 인플루언서',10)",[id(n),'ORDER'+n,status,total,'mock-'+n,id(999)]);if(pid!==null)await query("INSERT INTO order_items(order_id,product_id,product_ref,product_name,quantity,unit_price,supply_price,tax_type) VALUES($1,$2,$2,$3,1,$4,20000,'taxable')",[id(n),id(pid),'상품'+pid,total]);}
const profit=async()=>await (await api('admin/profit').GET(req())).json();
const inf=async()=>await (await api('admin/influencer-settlements').GET()).json();
const confirm=n=>api('admin/influencer-payouts').POST(req('/x','POST',{campaign_id:id(n),influencer_id:id(999)}));
const checkout=(n=1)=>({paymentKey:'approve-'+n,orderId:'provider-'+n,amount:100000,checkoutData:{productId:id(1),quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0}});
function mockApprove(){let calls=0;global.fetch=async(url,opts)=>{calls++;const p=JSON.parse(opts.body);return Response.json({paymentKey:p.paymentKey,orderId:p.orderId,totalAmount:p.amount,status:'DONE',method:'계좌이체'});};return ()=>calls;}

test('A1 import enforces supply cost and host category; errors are per row',async()=>{
 const route=api('admin/products/import');
 let res=await route.PUT(req('/x','PUT',{headers:['상품명','판매가'],rows:[['누락','10000']],mapping:{0:'name',1:'price'}}));
 let body=await res.json();assert.equal(body.saved,0);assert.equal(body.errors.length,1);
 res=await route.PUT(req('/x','PUT',{headers:['상품명','판매가','공급가'],rows:[['등록','10000','0']],mapping:{0:'name',1:'price',2:'supply_price'}}));body=await res.json();assert.equal(body.saved,1);
 const p=(await query('SELECT category,supply_price FROM products_shop')).rows[0];assert.ok(p.category.startsWith('산지픽'));assert.equal(p.supply_price,0);
});
test('A2 requests/exchanges preserve revenue; partial refund retains 80000 in both reports',async()=>{
 await product();await order();for(const status of ['paid','cancel_requested','exchange_requested','exchange_completed','return_requested']){await query('UPDATE orders SET status=$1',[status]);assert.equal((await profit())[0].gross,100000);}
 await query("UPDATE orders SET status='return_completed'");await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('partial',$1,20000)",[id(10)]);
 assert.equal((await profit())[0].gross,80000);const channels=await load('lib/link-sales.ts',mocks).getLinkSales(site,'2020-01-01','2099-01-01');assert.equal(Number(channels[0].net),80000);
});
test('A3 two products share exactly one order gross in preview and confirmation',async()=>{
 await product(1,40000);await product(2,60000);await order(10,100000,'paid',null);
 for(const [n,price] of [[1,40000],[2,60000]])await query("INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,supply_price,tax_type) VALUES($1,$2,$3,1,$4,20000,'taxable')",[id(10),id(n),'상품'+n,price]);
 const rows=await inf();assert.equal(rows.reduce((n,r)=>n+r.gross,0),100000);assert.equal(rows.reduce((n,r)=>n+r.commission,0),10000);
 const amounts=[];for(const n of [1,2]){const res=await confirm(n);assert.equal(res.status,201);amounts.push((await res.json()).payout.commission);}assert.equal(amounts.reduce((a,b)=>a+b),10000);
});
test('A4 current rate changes cannot rewrite old commission; line snapshots override legacy order rate',async()=>{
 await product();await order();await query('UPDATE products_shop SET influencer_rate=20');assert.equal((await inf())[0].commission,10000);assert.equal((await profit())[0].commission,10000);
 await query('UPDATE order_items SET commission_rate=15');assert.equal((await inf())[0].commission,15000);assert.equal((await profit())[0].commission,15000);
});
test('A5 archive preserves orders, options and payout history; old deleted references stay visible',async()=>{
 await product();await order();await confirm(1);
 const res=await api('admin/products/[id]').DELETE(req(),ctx(1));assert.equal(res.status,200);
 assert.ok((await query('SELECT archived_at FROM products_shop')).rows[0].archived_at);assert.equal((await inf()).length,1);
 await query('UPDATE order_items SET product_id=NULL');await query('DELETE FROM products_shop');assert.equal((await inf()).length,1);
 await query('UPDATE order_items SET product_ref=NULL');assert.ok((await inf()).some(r=>r.payout));
});
test('A6 transfer fees stay 1650 after delivery and remain explicitly estimated',async()=>{
 await product();await order(10,100000,'shipped');assert.equal((await profit())[0].pg_fee,1650);
 const res=await api('admin/shipments/deliver').PATCH(req('/x','PATCH',{orderIds:[id(10)]}));assert.equal(res.status,200);
 const row=(await profit())[0];assert.equal(row.pg_fee,1650);assert.equal(row.fee_estimated,true);
});
test('A7 individual cancellation writes refund once, restores once and forbids cancelled to delivered',async()=>{
 await product();await order(10,100000,'shipped');await api('admin/shipments/deliver').PATCH(req('/x','PATCH',{orderIds:[id(10)]}));
 let calls=0;global.fetch=async()=>{calls++;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};const route=api('admin/orders/[id]');
 for(let n=0;n<2;n++)assert.equal((await route.PATCH(req('/x','PATCH',{status:'cancelled'}),ctx(10))).status,200);
 assert.equal(calls,1);assert.equal((await query('SELECT SUM(amount)::int n FROM order_refund_amounts')).rows[0].n,100000);
 assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,21);
 assert.equal((await route.PATCH(req('/x','PATCH',{status:'delivered'}),ctx(10))).status,409);
 const s=await load('lib/settlement-view.ts',mocks).settlementView(site);assert.equal(s[0].net_amount,0);
});
test('A8 overlapping payout confirmation cannot reopen paid status',async()=>{
 await product();await order();await confirm(1);let hit=false;
 hook=async(sql,p,run)=>{if(!hit&&sql.includes('INSERT INTO influencer_payouts')){hit=true;await native("UPDATE influencer_payouts SET status='paid',paid_at=NOW()");}return run(sql,p);};
 const res=await confirm(1);assert.equal(res.status,409);hook=null;const row=(await query('SELECT status,paid_at FROM influencer_payouts')).rows[0];assert.equal(row.status,'paid');assert.ok(row.paid_at);
});
test('A9 approved payment survives item insert failure; retry recovers one order without another approval',async()=>{
 await product();let calls=mockApprove();let hit=false;hook=async(sql,p,run)=>{if(!hit&&sql.includes('INSERT INTO order_items')){hit=true;throw Error('Injected storage failure');}return run(sql,p);};
 const data=checkout();const route=api('payment/shop-confirm');const res=await route.POST(req('/x','POST',data));assert.equal(res.status,503);assert.equal(calls(),1);hook=null;
 assert.equal((await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,0);assert.equal((await query('SELECT status FROM payment_attempts')).rows[0].status,'needs_review');
 let lookups=0;global.fetch=async(url,opts)=>{assert.equal(opts.method,'GET');lookups++;return Response.json({paymentKey:data.paymentKey,orderId:data.orderId,totalAmount:data.amount,status:'DONE',method:'계좌이체'});};
 assert.equal((await route.POST(req('/x','POST',data))).status,200);assert.equal((await route.POST(req('/x','POST',data))).status,200);
 assert.equal(lookups,1);assert.equal((await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,1);assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,19);
});
test('A10 reserved last unit blocks a second checkout while first approval is in flight',async()=>{
 await product(1,100000,1);let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let calls=0;
 global.fetch=async(url,opts)=>{calls++;entered();await gate;const p=JSON.parse(opts.body);return Response.json({paymentKey:p.paymentKey,orderId:p.orderId,totalAmount:p.amount,status:'DONE',method:'카드'});};
 const route=api('payment/shop-confirm'),first=route.POST(req('/x','POST',checkout(1)));await ready;
 const second=await route.POST(req('/x','POST',checkout(2)));assert.notEqual(second.status,200);release();assert.equal((await first).status,200);assert.equal(calls,1);
 assert.equal((await query('SELECT SUM(quantity)::int n FROM order_items')).rows[0].n,1);assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,0);
});
test('A11 addon cost is snapshotted; legacy missing cost preserves sales and marks profit unknown',async()=>{
 await product();await query("INSERT INTO product_addons(product_id,name,extra_price,is_active,supply_price) VALUES($1,'포장',5000,true,1000)",[id(1)]);mockApprove();
 const data={paymentKey:'addon',orderId:'addon-order',amount:105000,checkoutData:{items:[{product_id:id(1),quantity:1},{product_id:null,quantity:1,is_addon:true,name:'[추가] 포장',price:5000}],totalAmount:105000,shippingCost:0}};
 const res=await api('payment/cart-confirm').POST(req('/x','POST',data));assert.equal(res.status,200);
 const addon=(await query('SELECT supply_price,product_ref FROM order_items WHERE product_id IS NULL')).rows[0];assert.equal(addon.supply_price,1000);assert.equal(addon.product_ref,id(1));
 assert.equal((await profit())[0].gross,105000);await query('UPDATE order_items SET supply_price=NULL WHERE product_id IS NULL');const row=(await profit())[0];assert.equal(row.gross,105000);assert.equal(row.missing_supply,1);assert.equal(row.net_profit,null);
});
test('A12 failed delivery transaction reports failure and zero committed deliveries',async()=>{
 await product();await order(10,100000,'shipped');await query("UPDATE orders SET tracking_company='04',tracking_number='1234567890'");process.env.SWEETTRACKER_API_KEY='TEST';global.fetch=async()=>Response.json({lastStateDetail:{level:6,text:'완료'}});
 hook=async(sql,p,run)=>{if(sql.includes("UPDATE orders SET status = 'delivered'"))throw Error('Injected delivery write failure');return run(sql,p);};
 const res=await api('admin/shipments/track').POST();hook=null;const body=await res.json();assert.equal(res.status,503);assert.equal(body.ok,false);assert.equal(body.delivered,0);assert.equal(body.failed,1);assert.equal((await query('SELECT status FROM orders')).rows[0].status,'shipped');
});
test('additional guards: invalid money, duplicate options, cross-site create and migration re-run',async()=>{
 const {productInputError}=load('lib/product-required.ts',mocks),base={name:'상품',price:10000,category:'산지픽',supply_price:1000};
 for(const value of [-1,Infinity,true,'oops',1.5])assert.ok(productInputError({...base,supply_price:value},site));
 assert.ok(productInputError({...base,options:[{name:'중복'},{name:'중복'}]},site));assert.ok(productInputError(base,'blendpick'));
 await product();await order();await db.exec(fs.readFileSync('scripts/admin-integrity.sql','utf8'));assert.equal((await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,1);
});
test('additional guards: item tax snapshot and KST range are independent of current product and DB timezone',async()=>{
 await product();await order();await query("UPDATE order_items SET tax_type='exempt'");await query("UPDATE orders SET paid_at='2026-09-07T15:00:00Z'");
 const route=api('admin/profit');let res=await route.GET(req('/x?from=2026-09-08&to=2026-09-08'));assert.equal((await res.json())[0].sales_vat,0);
 res=await route.GET(req('/x?from=2026-09-07&to=2026-09-07'));assert.equal((await res.json()).length,0);assert.equal((await route.GET(req('/x?from=bad'))).status,400);
});
test('additional guards: recovery rejects non-admin, other site and altered checkout data',async()=>{
 await product();global.fetch=async()=>{throw Error('timeout');};const data=checkout();assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',data))).status,503);
 assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',{...data,amount:90000}))).status,409);
 auth=false;assert.equal((await api('admin/payment-recovery').GET()).status,401);assert.equal((await api('admin/payment-recovery').POST(req('/x','POST',{orderId:data.orderId}))).status,401);
 auth=true;site='blendpick';assert.equal((await api('admin/payment-recovery').POST(req('/x','POST',{orderId:data.orderId}))).status,404);
});
test('recovery releases reservations once only after provider confirms failure',async()=>{
 await product(1,100000,1);global.fetch=async()=>{throw Error('lost response');};const d=checkout();const checkoutRoute=api('payment/shop-confirm');
 assert.equal((await checkoutRoute.POST(req('/x','POST',d))).status,503);assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,0);
 global.fetch=async(url,opts)=>{assert.equal(opts.method,'GET');return Response.json({paymentKey:d.paymentKey,orderId:d.orderId,totalAmount:d.amount,status:'ABORTED'});};
 const route=api('admin/payment-recovery');assert.equal((await route.POST(req('/x','POST',{orderId:d.orderId}))).status,400);
 assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,1);assert.equal((await query('SELECT status FROM payment_attempts')).rows[0].status,'failed');
 await route.POST(req('/x','POST',{orderId:d.orderId}));assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,1);
});
test('stale product form cannot overwrite a checkout stock reservation',async()=>{
 const base={name:'사과',price:100000,category:'산지픽',supply_price:20000,stock:1,shipping_type:'free',tax_type:'taxable',options:[],addons:[]};
 const create=await api('admin/products').POST(req('/x','POST',base));assert.equal(create.status,201);const pid=(await create.json()).id;
 const context={params:Promise.resolve({id:pid})};const detail=api('admin/products/[id]');const old=await (await detail.GET(req(),context)).json();
 mockApprove();const d=checkout();d.checkoutData.productId=pid;assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',d))).status,200);
 const res=await detail.PATCH(req('/x','PATCH',{...base,expected_updated_at:old.updated_at}),context);assert.equal(res.status,409);
 assert.equal((await query('SELECT stock FROM products_shop WHERE id=$1',[pid])).rows[0].stock,0);
});
test('payout payment marking rejects a refund after confirmation; repeated paid action preserves timestamp',async()=>{
 await product();await order();const response=await confirm(1);const pid=(await response.json()).id;const route=api('admin/influencer-payouts/[id]'),context={params:Promise.resolve({id:pid})};
 await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('late',$1,10000)",[id(10)]);
 assert.equal((await route.PATCH(req('/x','PATCH',{status:'paid'}),context)).status,409);
 await confirm(1);assert.equal((await route.PATCH(req('/x','PATCH',{status:'paid'}),context)).status,200);
 const first=(await query('SELECT paid_at FROM influencer_payouts WHERE id=$1',[pid])).rows[0].paid_at;
 assert.equal((await route.PATCH(req('/x','PATCH',{status:'paid'}),context)).status,200);assert.deepEqual((await query('SELECT paid_at FROM influencer_payouts WHERE id=$1',[pid])).rows[0].paid_at,first);
});
test('cart stores each product rate and tax at payment time, independent of cart ordering',async()=>{
 await product(1,40000);await product(2,60000);await query("UPDATE products_shop SET influencer_rate=20,tax_type='exempt' WHERE id=$1",[id(2)]);mockApprove();
 const d={paymentKey:'mixed',orderId:'mixed-order',amount:100000,checkoutData:{influencerId:id(999),items:[{product_id:id(1),quantity:1},{product_id:id(2),quantity:1}],totalAmount:100000,shippingCost:0}};
 assert.equal((await api('payment/cart-confirm').POST(req('/x','POST',d))).status,200);
 await query('UPDATE products_shop SET influencer_rate=99');const rows=await inf();assert.equal(rows.reduce((s,r)=>s+r.commission,0),16000);assert.equal((await profit())[0].sales_vat,3636);
});
