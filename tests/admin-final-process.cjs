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
const originalFetch=global.fetch;const observations=[];
function observe(name,value){observations.push({name,...value});console.log('OBSERVATION',JSON.stringify(observations.at(-1)));}
mocks['@/lib/return-notify']={sendReturnRefundSMS:async()=>{throw Error('SMS blocked');}};
mocks['@/lib/hotel-notify']={sendCancellationSMS:async()=>({ok:true})};
before(async()=>{await setup(db,id);await db.exec("ALTER TABLE orders ADD COLUMN stay_check_in date; ALTER TABLE orders ADD COLUMN stay_check_out date; CREATE TABLE hotel_room_inventory(stay_date date,room_type text,booked int);");});
beforeEach(async()=>{site='sanjipick';auth=true;hook=null;global.fetch=async()=>{throw Error('UNMOCKED NETWORK BLOCKED');};await db.exec('TRUNCATE payment_attempts,products_shop,product_options,product_addons,orders,order_items,settlements,campaign_costs,influencer_payouts,product_secret_links,order_refund_amounts,product_images,order_returns,order_return_events,hotel_room_inventory CASCADE');});
after(async()=>{global.fetch=originalFetch;if(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH,JSON.stringify(observations,null,2));await db.close();});
async function product(n=1,price=100000,stock=20){await query("INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,supply_price,influencer_rate,influencer_id,tax_type) VALUES($1,$2,'산지픽',$3,$4,'active',true,'free',0,20000,10,$5,'taxable')",[id(n),'상품'+n,price,stock,id(999)]);}
async function order(n=10,total=100000,status='paid',pid=1){await query("INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key,payment_method,influencer_id,influencer_name,commission_rate) VALUES($1,'sanjipick','shop',$2,NOW(),$3,$4,0,$5,'계좌이체',$6,'테스트 인플루언서',10)",[id(n),'ORDER'+n,status,total,'mock-'+n,id(999)]);if(pid!==null)await query("INSERT INTO order_items(order_id,product_id,product_ref,product_name,quantity,unit_price,supply_price,tax_type) VALUES($1,$2,$2,$3,1,$4,20000,'taxable')",[id(n),id(pid),'상품'+pid,total]);}
const profit=async()=>await (await api('admin/profit').GET(req())).json();
const inf=async()=>await (await api('admin/influencer-settlements').GET()).json();
const confirm=n=>api('admin/influencer-payouts').POST(req('/x','POST',{campaign_id:id(n),influencer_id:id(999)}));
const checkout=(n=1)=>({paymentKey:'approve-'+n,orderId:'provider-'+n,amount:100000,checkoutData:{productId:id(1),quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0}});
function mockApprove(){let calls=0;global.fetch=async(url,opts)=>{calls++;const p=JSON.parse(opts.body);return Response.json({paymentKey:p.paymentKey,orderId:p.orderId,totalAmount:p.amount,status:'DONE',method:'계좌이체'});};return ()=>calls;}

// These tests assert the desired process invariant. Failures reveal gaps in the reviewed commit.
const baseForm=(overrides={})=>({name:'검증 상품',price:100000,category:'산지픽',supply_price:20000,stock:10,shipping_type:'free',shipping_cost:0,status:'active',tax_type:'taxable',options:[],addons:[],...overrides});
async function createForm(body){const res=await api('admin/products').POST(req('/x','POST',body));assert.equal(res.status,201);const pid=(await res.json()).id;return {pid,context:{params:Promise.resolve({id:pid})}};}

// Only previously untested sequences. Run this file alone to avoid repeating the 83 checks.
test('F1 refund in flight must block a competing shipment transition',async()=>{
 await product();await order();let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 global.fetch=async()=>{enter();await gate;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};
 const cancel=load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'관리자 취소',{site});await ready;
 let shipped;try {shipped=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'04',tracking_number:'001234567890'}),ctx(10));}finally{release();}
 const cancelled=await cancel;const o=(await query('SELECT status,shipped_at,tracking_number FROM orders')).rows[0];
 observe('F1',{shipResponse:shipped.status,cancelOk:cancelled.ok,finalStatus:o.status,shipmentRecorded:!!o.shipped_at,trackingRecorded:!!o.tracking_number});
 assert.equal(shipped.status,409,'환불 진행 중인 주문을 발송 처리하면 안 된다');
});

test('F2 simple-product stock survives reopening and saving a former option product',async()=>{
 const body=baseForm({options:[{name:'3kg',price:100000,stock:10,supply_price:20000}]});const {pid,context}=await createForm(body),detail=api('admin/products/[id]');
 const original=await (await detail.GET(req(),context)).json();assert.equal((await detail.PATCH(req('/x','PATCH',{...body,options:[],stock:10,expected_updated_at:original.updated_at}),context)).status,200);
 const reopened=await (await detail.GET(req(),context)).json();
 // ProductFormClient.fillFromData retains the API options, including inactive history rows.
 const saved=await detail.PATCH(req('/x','PATCH',{...body,name:'설명 수정 후 상품',stock:reopened.stock,options:reopened.options,expected_updated_at:reopened.updated_at}),context);
 const stock=(await query('SELECT stock FROM products_shop WHERE id=$1',[pid])).rows[0].stock;
 const verified=await load('lib/order-amount.ts',mocks).verifySingleAmount({site,productId:pid,quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0,amount:100000});
 observe('F2',{saveStatus:saved.status,reopenedOptionCount:reopened.options.length,stockBefore:reopened.stock,stockAfter:stock,purchasable:verified.ok});
 assert.equal(stock,10,'편집 재진입에서 보관 옵션 때문에 일반 상품 재고가 0이 되면 안 된다');assert.equal(verified.ok,true);
});

async function addReturn(n=50){await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'return','collecting','delivered','부분 반품')",[id(n),id(10)]);}
test('F3 two separate partial returns accumulate the remaining balance without sharing operation keys',async()=>{
 await product();await order(10,100000,'return_requested');let refunded=0;const keys=new Set();
 global.fetch=async(url,opts)=>{keys.add(opts.headers['Idempotency-Key']);refunded+=JSON.parse(opts.body).cancelAmount;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:100000-refunded,status:'PARTIAL_CANCELED'});};
 const route=api('admin/returns');await addReturn(50);assert.equal((await route.PATCH(req('/x','PATCH',{id:id(50),action:'complete',refund_amount:20000}))).status,200);
 await query("UPDATE orders SET status='return_requested'");await addReturn(51);assert.equal((await route.PATCH(req('/x','PATCH',{id:id(51),action:'complete',refund_amount:30000}))).status,200);
 const ledger=Number((await query('SELECT SUM(amount) n FROM order_refund_amounts')).rows[0].n),sales=(await profit())[0].gross;
 observe('F3',{providerRefund:refunded,ledgerRefund:ledger,remainingSales:sales,independentKeys:keys.size});assert.equal(ledger,50000);assert.equal(sales,50000);assert.equal(keys.size,2);
});

test('F4 exchange completion followed by a return preserves the actual refund amount',async()=>{
 await product();await order(10,100000,'exchange_requested');await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'exchange','collecting','delivered','교환')",[id(50),id(10)]);
 const route=api('admin/returns');assert.equal((await route.PATCH(req('/x','PATCH',{id:id(50),action:'complete'}))).status,200);const before=(await profit())[0].gross;
 await query("UPDATE orders SET status='return_requested'");await addReturn(51);global.fetch=async()=>Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:75000,status:'PARTIAL_CANCELED'});
 assert.equal((await route.PATCH(req('/x','PATCH',{id:id(51),action:'complete',refund_amount:25000}))).status,200);
 const sales=(await profit())[0].gross;observe('F4',{salesAfterExchange:before,salesAfterReturn:sales,ledgerRows:(await query('SELECT COUNT(*)::int n FROM order_refund_amounts')).rows[0].n});assert.equal(before,100000);assert.equal(sales,75000);
});

test('F5 foreign-site and unauthenticated return completion cannot create refund intent',async()=>{
 await product();await order(10,100000,'return_requested');await addReturn();const route=api('admin/returns'),body={id:id(50),action:'complete',refund_amount:20000};
 auth=false;const unauth=await route.PATCH(req('/x','PATCH',body));auth=true;site='blendpick';const other=await route.PATCH(req('/x','PATCH',body));
 const count=(await query('SELECT COUNT(*)::int n FROM refund_operations')).rows[0].n;observe('F5',{unauthStatus:unauth.status,foreignSiteStatus:other.status,refundIntents:count});assert.equal(unauth.status,401);assert.equal(other.status,404);assert.equal(count,0);
});

test('F6 new product through payment shipment delivery return and revenue report',async()=>{
 const {pid}=await createForm(baseForm());const d=checkout();d.checkoutData.productId=pid;mockApprove();const paid=await api('payment/shop-confirm').POST(req('/x','POST',d));assert.equal(paid.status,200);
 const o=(await query('SELECT id,payment_key FROM orders')).rows[0],context={params:Promise.resolve({id:o.id})};const detail=api('admin/orders/[id]');
 for(const status of ['confirmed','preparing','shipped','delivered'])assert.equal((await detail.PATCH(req('/x','PATCH',{status,tracking_company:'04',tracking_number:'001234567890'}),context)).status,200);
 await query("UPDATE orders SET status='return_requested' WHERE id=$1",[o.id]);await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'return','requested','delivered','부분 반품')",[id(50),o.id]);
 const returns=api('admin/returns');assert.equal((await returns.PATCH(req('/x','PATCH',{id:id(50),action:'collect'}))).status,200);
 global.fetch=async()=>Response.json({paymentKey:o.payment_key,totalAmount:100000,balanceAmount:70000,status:'PARTIAL_CANCELED'});assert.equal((await returns.PATCH(req('/x','PATCH',{id:id(50),action:'complete',refund_amount:30000}))).status,200);
 const report=(await profit())[0];const stock=(await query('SELECT stock FROM products_shop WHERE id=$1',[pid])).rows[0].stock;
 observe('F6',{orders:(await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,stock,finalStatus:(await query('SELECT status FROM orders')).rows[0].status,sales:report.gross,refunds:report.refunds});
 assert.equal(stock,9);assert.equal(report.gross,70000);assert.equal(report.refunds,30000);
});

async function pendingRefund(orderId=id(10)) {
 await query(`INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,payment_key,total,idempotency_key,status) VALUES($1,$2,10000,0,'검증',$3,100000,$4,'processing')`,['pending:'+orderId,orderId,'mock-10','key:'+orderId]);
}
test('J1 shipment import rolls back the entire mixed batch and sends no SMS on refund conflict',async()=>{
 await product();await order(10);await order(11);await pendingRefund();let messages=0;
 const route=load('app/api/admin/shipments/import/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true},'@/lib/ship-notify':{sendShipmentSMS:async()=>{messages++;return {ok:true};}}});
 const response=await route.POST(req('/x','POST',{rows:[{order_number:'ORDER11',carrier:'04',tracking_number:'111111'},{order_number:'ORDER10',carrier:'04',tracking_number:'222222'}]}));
 assert.equal(response.status,409);assert.equal(messages,0);assert.ok((await query('SELECT status,tracking_number FROM orders')).rows.every(o=>o.status==='paid'&&o.tracking_number===null));
});
test('J2 bulk order progression and cancellation rejection obey the refund guard',async()=>{
 await product();const route=api('admin/orders');
 for(const [n,status,action] of [[10,'paid','confirm'],[11,'confirmed','dispatch'],[12,'cancel_requested','cancel_reject']]) {
   await order(n,100000,status);await pendingRefund(id(n));
   assert.equal((await route.PATCH(req('/x','PATCH',{orderIds:[id(n)],action}))).status,409);
   assert.equal((await query('SELECT status FROM orders WHERE id=$1',[id(n)])).rows[0].status,status);
 }
});
test('J3 manual automatic and worker delivery writes cannot settle a pending refund',async()=>{
 await product();await order(10,100000,'shipped');await query("UPDATE orders SET tracking_company='04',tracking_number='1234567890'");await pendingRefund();
 assert.equal((await api('admin/shipments/deliver').PATCH(req('/x','PATCH',{orderIds:[id(10)]}))).status,409);
 const originalKey=process.env.SWEETTRACKER_API_KEY;process.env.SWEETTRACKER_API_KEY='isolated-test';global.fetch=async()=>Response.json({lastStateDetail:{level:6,text:'완료'}});
 try {const response=await api('admin/shipments/track').POST();const body=await response.json();assert.equal(response.status,503);assert.equal(body.delivered,0);assert.equal(body.writeFailed,true);}finally{if(originalKey===undefined)delete process.env.SWEETTRACKER_API_KEY;else process.env.SWEETTRACKER_API_KEY=originalKey;}
 // Execute the exact UPDATE text from the scheduled worker; do not launch its network job.
 const worker=fs.readFileSync('scripts/auto-track-shipments.cjs','utf8');const sql=worker.match(/`(UPDATE orders SET status = 'delivered',[\s\S]*?)`/)[1];
 await assert.rejects(query(sql,[[id(10)]]),e=>e.code==='P2001');
 assert.equal((await query('SELECT status FROM orders')).rows[0].status,'shipped');assert.equal((await query('SELECT COUNT(*)::int n FROM settlements')).rows[0].n,0);
});
test('J4 tracking repair and reimport cannot alter a shipment while refund is pending',async()=>{
 await product();await order(10,100000,'shipped');await pendingRefund();
 assert.equal((await api('admin/orders/[id]').PATCH(req('/x','PATCH',{action:'repair_tracking',tracking_company:'04',tracking_number:'1234567890'}),ctx(10))).status,409);
 assert.equal((await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'1234567890'}]}))).status,409);
 assert.equal((await query('SELECT tracking_number FROM orders')).rows[0].tracking_number,null);
});
test('J5 removed option history remains linked while same-name replacement gets a new identity',async()=>{
 const body=baseForm({options:[{name:'3kg',price:100000,stock:10,supply_price:20000}]});const {pid,context}=await createForm(body),route=api('admin/products/[id]');
 const initial=await (await route.GET(req(),context)).json(),oldId=initial.options[0].id;
 await order(10,100000,'paid',null);await query('INSERT INTO order_items(order_id,product_id,option_id,quantity,unit_price) VALUES($1,$2,$3,1,100000)',[id(10),pid,oldId]);
 assert.equal((await route.PATCH(req('/x','PATCH',{...body,options:[],expected_updated_at:initial.updated_at}),context)).status,200);
 const removed=await (await route.GET(req(),context)).json();assert.equal(removed.options.length,0);
 assert.ok((await query('SELECT removed_at FROM product_options WHERE id=$1',[oldId])).rows[0].removed_at);
 assert.equal((await route.PATCH(req('/x','PATCH',{...body,expected_updated_at:removed.updated_at}),context)).status,200);
 const next=await (await route.GET(req(),context)).json();assert.notEqual(next.options[0].id,oldId);
 assert.equal((await query('SELECT option_id FROM order_items WHERE order_id=$1',[id(10)])).rows[0].option_id,oldId);
 const verifier=load('lib/order-amount.ts',mocks);const amount={site,productId:pid,quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0,amount:100000};assert.equal((await verifier.verifySingleAmount({...amount,optionId:oldId})).ok,false);assert.equal((await verifier.verifySingleAmount({...amount,optionId:next.options[0].id})).ok,true);
});
test('J6 paused options remain editable and can resume with the same identity',async()=>{
 const body=baseForm({options:[{name:'3kg',price:100000,stock:10,supply_price:20000,active:false}]});const {pid,context}=await createForm(body),route=api('admin/products/[id]');
 const paused=await (await route.GET(req(),context)).json();assert.equal(paused.options.length,1);assert.equal(paused.options[0].active,false);
 assert.equal((await route.PATCH(req('/x','PATCH',{...body,options:paused.options,expected_updated_at:paused.updated_at}),context)).status,200);
 const read=await (await route.GET(req(),context)).json();assert.equal(read.stock,0);assert.equal(read.options[0].id,paused.options[0].id);
 assert.equal((await route.PATCH(req('/x','PATCH',{...body,options:read.options.map(o=>({...o,active:true})),expected_updated_at:read.updated_at}),context)).status,200);
 const active=await (await route.GET(req(),context)).json();assert.equal(active.stock,10);assert.equal(active.options[0].id,paused.options[0].id);
});
