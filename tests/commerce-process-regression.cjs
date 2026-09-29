const {shipmentApi}=require('./support/shipment-import.cjs');
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
const api=path=>path==='admin/shipments/import'?shipmentApi(mocks):load('app/api/'+path+'/route.ts',mocks),ctx=n=>({params:Promise.resolve({id:id(n)})});
const originalFetch=global.fetch;const observations=[];
function observe(name,value){observations.push({name,...value});console.log('OBSERVATION',JSON.stringify(observations.at(-1)));}
mocks['@/lib/return-notify']={sendReturnRefundSMS:async()=>{throw Error('SMS blocked');}};
mocks['@/lib/hotel-notify']={sendCancellationSMS:async()=>({ok:true})};
before(async()=>{await setup(db,id);await db.exec("ALTER TABLE orders ADD COLUMN stay_check_in date; ALTER TABLE orders ADD COLUMN stay_check_out date; CREATE TABLE hotel_room_inventory(stay_date date,room_type text,booked int);");await db.exec(fs.readFileSync('scripts/admin-workflow.sql','utf8'));await db.exec(`ALTER TABLE order_returns ALTER COLUMN id SET DEFAULT gen_random_uuid(); ALTER TABLE order_returns ALTER COLUMN status SET DEFAULT 'requested'; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS detail text; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS items jsonb; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS photos jsonb; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS pickup_address text; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS pickup_detail text; ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS fee_agreed boolean;`);});
beforeEach(async()=>{site='sanjipick';auth=true;hook=null;global.fetch=async()=>{throw Error('UNMOCKED NETWORK BLOCKED');};await db.exec('TRUNCATE admin_dispatch_batches,payment_attempts,products_shop,product_options,product_addons,orders,order_items,settlements,campaign_costs,influencer_payouts,product_secret_links,order_refund_amounts,product_images,order_returns,order_return_events,hotel_room_inventory CASCADE');});
after(async()=>{global.fetch=originalFetch;if(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH,JSON.stringify(observations,null,2));await db.close();});
async function product(n=1,price=100000,stock=20){await query("INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,supply_price,influencer_rate,influencer_id,tax_type) VALUES($1,$2,$6,$3,$4,'active',true,'free',0,20000,10,$5,'taxable')",[id(n),'상품'+n,price,stock,id(999),site==='sanjipick'?'산지픽':'기타']);}
async function order(n=10,total=100000,status='paid',pid=1){await query("INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key,payment_method,influencer_id,influencer_name,commission_rate) VALUES($1,'sanjipick','shop',$2,NOW(),$3,$4,0,$5,'계좌이체',$6,'테스트 인플루언서',10)",[id(n),'ORDER'+n,status,total,'mock-'+n,id(999)]);if(pid!==null)await query("INSERT INTO order_items(order_id,product_id,product_ref,product_name,quantity,unit_price,supply_price,tax_type) VALUES($1,$2,$2,$3,1,$4,20000,'taxable')",[id(n),id(pid),'상품'+pid,total]);}
const profit=async()=>await (await api('admin/profit').GET(req())).json();
const inf=async()=>await (await api('admin/influencer-settlements').GET()).json();
const confirm=n=>api('admin/influencer-payouts').POST(req('/x','POST',{campaign_id:id(n),influencer_id:id(999)}));
const checkout=(n=1)=>({paymentKey:'approve-'+n,orderId:'provider-'+n,amount:100000,checkoutData:{productId:id(1),quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0}});
function mockApprove(){let calls=0;global.fetch=async(url,opts)=>{calls++;const p=JSON.parse(opts.body);return Response.json({paymentKey:p.paymentKey,orderId:p.orderId,totalAmount:p.amount,status:'DONE',method:'계좌이체'});};return ()=>calls;}




// Regression coverage: real routes and a disposable database, no production access.
for(const scope of ['blendpick','sanjipick']){
 test(`${scope}: dispatch download must exclude a subsequently cancelled order`,async()=>{
  site=scope;await product();await order();
  await query('UPDATE orders SET site=$1,buyer_name=$2,buyer_phone=$3,addr_zipcode=$4,addr_address=$5',[site,'격리테스트','01000000000','12345','테스트 주소']);
  const batch=await load('lib/admin-dispatch.ts',mocks).confirmDispatch(site,id(501),[id(10)]);
  global.fetch=async()=>Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});
  const result=await load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'격리 취소',{site,customerRequest:true});
  assert.equal(result.ok,true);assert.equal(result.requested,true);assert.equal(result.refunded,false);
  assert.equal((await query('SELECT status FROM orders')).rows[0].status,'cancel_requested');
  const downloaded=await (await api('admin/dispatches').GET(req('/api/admin/dispatches?id='+batch.id))).json();
  observe('AUDIT-1',{site,status:(await query('SELECT status FROM orders')).rows[0].status,downloadRows:downloaded.snapshot.length,excluded:downloaded.excluded.length});
  assert.equal(downloaded.snapshot.length,0,'Cancelled order remains in dispatch export');
 });
 test(`${scope}: detail shipment must enforce the same dispatch rule as import`,async()=>{
  site=scope;await product();await order();await query('UPDATE orders SET site=$1',[site]);
  const row={order_number:'ORDER10',tracking_number:'123456789012',carrier:'05'};
  const bulk=await (await api('admin/shipments/import').POST(req('/x','POST',{rows:[row]}))).json();
  const detail=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'05',tracking_number:row.tracking_number}),ctx(10));
  observe('AUDIT-2a',{site,bulkSucceeded:bulk.succeeded,detailHTTP:detail.status,finalStatus:(await query('SELECT status FROM orders')).rows[0].status,dispatchRows:(await query('SELECT count(*)::int n FROM admin_dispatch_batches WHERE order_ids @> ARRAY[$1::uuid]',[id(10)])).rows[0].n});
  assert.equal(detail.status,409,'Detail API accepts an order that has not passed dispatch confirmation');
 });
 test(`${scope}: detail invoice registration must enqueue the same notification as Excel import`,async()=>{
  site=scope;await product();await order(10,100000,'preparing');await order(11,100000,'preparing');await query('UPDATE orders SET site=$1',[site]);
  const bulk=await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',tracking_number:'123456789012',carrier:'05'}]}));assert.equal(bulk.status,200);
  const detail=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'05',tracking_number:'123456789013'}),ctx(11));assert.equal(detail.status,200);
  const jobs=(await query('SELECT o.order_number,n.id IS NOT NULL AS queued FROM orders o LEFT JOIN shipment_notifications n ON n.order_id=o.id ORDER BY o.order_number')).rows;
  observe('AUDIT-2b',{site,jobs});
  assert.equal(jobs.filter(r=>r.queued).length,2,'Individual shipment misses notification outbox');
 });
 test(`${scope}: checkout must reject missing buyer and shipping details before approval`,async()=>{
  site=scope;await product();
  let approvals=0;global.fetch=async(url,opts)=>{approvals++;const b=JSON.parse(opts.body);return Response.json({paymentKey:b.paymentKey,orderId:b.orderId,totalAmount:b.amount,status:'DONE',method:'카드'});};
  const route=load('app/api/payment/shop-confirm/route.ts',{...mocks,'@/lib/auth':{verifyAdminToken:async()=>({}),verifyToken:async()=>({id:id(900)})}});
  const response=await route.POST(req('/api/payment/shop-confirm','POST',checkout()));
  const saved=(await query('SELECT status,buyer_name,buyer_phone,addr_address FROM orders')).rows;
  observe('AUDIT-3',{site,http:response.status,approvals,orders:saved});
  assert.equal(approvals,0,'Incomplete checkout reached payment approval');
 });
 test(`${scope}: after partial return the remaining quantity must still be returnable`,async()=>{
  site=scope;await product();await order(10,100000,'delivered');await query('UPDATE orders SET site=$1,buyer_phone=$2',[site,'01000000000']);await query('UPDATE order_items SET quantity=2,unit_price=50000');
  const item=(await query('SELECT id FROM order_items')).rows[0];
  const customer=load('app/api/orders/[id]/return/route.ts',{...mocks,'@/lib/phone-verify':{isPhoneVerified:async()=>true},'@/lib/site-server':{currentSite:async()=>({key:site})}});
  const body={kind:'return',reason:'상품 불량·파손',items:[{item_id:item.id,quantity:1}]};
  const first=await customer.POST(req('/x','POST',body),ctx(10));assert.equal(first.status,200);
  const ret=(await query('SELECT id FROM order_returns')).rows[0];
  global.fetch=async()=>Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:50000,status:'PARTIAL_CANCELED'});
  const completed=await api('admin/returns').PATCH(req('/x','PATCH',{id:ret.id,action:'complete',refund_amount:50000}));assert.equal(completed.status,200);
  const second=await customer.POST(req('/x','POST',body),ctx(10));
  observe('AUDIT-4',{site,returnedQuantity:1,purchasedQuantity:2,finalStatus:(await query('SELECT status FROM orders')).rows[0].status,secondHTTP:second.status,message:(await second.json()).error});
  assert.equal(second.status,200,'Partial return closes the whole order to further return requests');
 });
}
test('extra payment approved but save failure remains recoverable and retry does not approve again',async()=>{
 site='blendpick';let approvals=0;
 global.fetch=async()=>{approvals++;return Response.json({paymentKey:'mock-extra',orderId:'provider-extra',totalAmount:1000,status:'DONE',method:'카드'});};
 hook=async(sql,p,run)=>{if(sql.includes('INSERT INTO order_items'))throw Error('INJECTED_SAVE_FAILURE');return run(sql,p);};
 const route=load('app/api/payment/extra-confirm/route.ts',{...mocks,'@/lib/pay-link':{verifyPayLink:async()=>({site:'blendpick',amount:1000,label:'테스트 추가결제'})},'@/lib/phone-verify':{isPhoneVerified:async()=>true}});
 const result=await route.POST(req('/x','POST',{paymentKey:'mock-extra',orderId:'provider-extra',amount:1000,token:'isolated',name:'격리테스트',phone:'01000000000'}));hook=null;
 const orders=(await query('SELECT count(*)::int n FROM orders')).rows[0].n;
 const attempts=(await query('SELECT count(*)::int n FROM payment_attempts')).rows[0].n;
 const list=await (await api('admin/payment-recovery').GET()).json();
 observe('AUDIT-5',{http:result.status,approvals,orders,attempts,recoveryRows:list.length});
 assert.equal(result.status,503);assert.equal(orders,0);assert.equal(attempts,1);assert.equal(list.length,1);
 global.fetch=async(_url,options)=>{assert.notEqual(options?.method,'POST');return Response.json({paymentKey:'mock-extra',orderId:'provider-extra',totalAmount:1000,status:'DONE',method:'카드'});};
 const recovered=await api('admin/payment-recovery').POST(req('/x','POST',{orderId:'provider-extra'}));assert.equal(recovered.status,200,await recovered.clone().text());
 assert.equal((await query('SELECT count(*)::int n FROM orders')).rows[0].n,1);
 const saved=(await query('SELECT order_type,total_amount FROM orders')).rows[0];assert.equal(saved.order_type,'extra');assert.equal(saved.total_amount,1000);
 const retried=await route.POST(req('/x','POST',{paymentKey:'mock-extra',orderId:'provider-extra',amount:1000,token:'isolated',name:'격리테스트',phone:'01000000000'}));assert.equal(retried.status,200);
 const response=await retried.json();assert.equal(response.amount,1000);assert.equal(response.label,'테스트 추가결제');
 assert.equal((await query('SELECT count(*)::int n FROM orders')).rows[0].n,1);
});

async function readyOrder(scope,status='paid') {
 site=scope;await product();await order(10,100000,status);
 await query("UPDATE orders SET site=$1,buyer_name='격리 구매자',buyer_phone='01000000000',addr_zipcode='12345',addr_address='격리 주소'",[site]);
}
const customerApi=path=>load('app/api/orders/[id]/'+path+'/route.ts',{...mocks,'@/lib/phone-verify':{isPhoneVerified:async()=>true},'@/lib/site-server':{currentSite:async()=>({key:site})}});
for(const scope of ['blendpick','sanjipick']) {
 test(`${scope}: preparing cancellation waits for a recorded supplier stop confirmation`,async()=>{
  await readyOrder(scope);const batch=await load('lib/admin-dispatch.ts',mocks).confirmDispatch(site,id(501),[id(10)]);
  let refunds=0;global.fetch=async()=>{refunds++;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};
  const request=await customerApi('cancel').POST(req('/x','POST'),ctx(10));assert.equal(request.status,200);assert.equal((await request.json()).status,'cancel_requested');assert.equal(refunds,0);
  assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,20);
  const detail=api('admin/orders/[id]');assert.equal((await detail.PATCH(req('/x','PATCH',{status:'cancelled'}),ctx(10))).status,409);assert.equal(refunds,0);
  assert.equal((await api('admin/orders').PATCH(req('/x','PATCH',{action:'cancel_confirm',orderIds:[id(10)]}))).status,409);
  const result=await api('admin/orders').PATCH(req('/x','PATCH',{action:'cancel_confirm',orderIds:[id(10)],dispatch_stop_confirmed:true}));assert.equal(result.status,200);assert.equal((await result.json()).updated,1);assert.equal(refunds,1);
  const saved=(await query('SELECT status,dispatch_stop_confirmed_at,dispatch_stop_confirmed_by FROM orders')).rows[0];assert.equal(saved.status,'cancelled');assert.ok(saved.dispatch_stop_confirmed_at);assert.equal(saved.dispatch_stop_confirmed_by,'관리자');
  const downloaded=await (await api('admin/dispatches').GET(req('/x?id='+batch.id))).json();assert.equal(downloaded.snapshot.length,0);assert.equal(downloaded.excluded.length,1);
  const history=(await query('SELECT snapshot FROM admin_dispatch_batches')).rows[0];assert.equal(history.snapshot.length,1);assert.equal(history.snapshot[0].status,'paid');
  assert.equal((await detail.PATCH(req('/x','PATCH',{status:'cancelled'}),ctx(10))).status,200);assert.equal(refunds,1);
 });
 test(`${scope}: rejecting a preparing cancellation returns to preparing, not a new dispatch`,async()=>{
  await readyOrder(scope,'preparing');assert.equal((await customerApi('cancel').POST(req('/x','POST'),ctx(10))).status,200);
  assert.equal((await api('admin/orders').PATCH(req('/x','PATCH',{action:'cancel_reject',orderIds:[id(10)]}))).status,200);
  assert.equal((await query('SELECT status FROM orders')).rows[0].status,'preparing');
  const file=await api('admin/dispatches').POST(req('/x','POST',{action:'download',orderIds:[id(10)]}));assert.equal(file.status,200);assert.equal((await file.json()).snapshot.length,1);
 });
 test(`${scope}: selected export excludes cancelled, pending and unconfirmed orders`,async()=>{
  await readyOrder(scope,'preparing');await order(11,100000,'cancelled');await order(12,100000,'paid');await order(13,100000,'cancel_requested');await query('UPDATE orders SET site=$1',[site]);
  const file=await api('admin/dispatches').POST(req('/x','POST',{action:'download',orderIds:[10,11,12,13].map(id)}));assert.equal(file.status,200);const b=await file.json();assert.equal(b.snapshot.length,1);assert.equal(b.snapshot[0].order_number,'ORDER10');assert.equal(b.excluded.length,3);assert.equal(b.snapshot[0].payment_key,undefined);
  assert.equal((await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'preparing'}),ctx(12))).status,409);
 });
 test(`${scope}: individual invoice and notification roll back together if queue storage fails`,async()=>{
  await readyOrder(scope,'preparing');hook=async(sql,p,run)=>{if(sql.includes('INSERT INTO shipment_notifications'))throw Error('INJECTED_OUTBOX_FAILURE');return run(sql,p);};
  const result=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'05',tracking_number:'123456789012'}),ctx(10));hook=null;
  assert.equal(result.status,500);assert.equal((await query('SELECT status FROM orders')).rows[0].status,'preparing');assert.equal((await query('SELECT count(*)::int n FROM shipment_notifications')).rows[0].n,0);
 });
 test(`${scope}: individual shipment sends once after commit and duplicate save cannot duplicate notification`,async()=>{
  await readyOrder(scope,'preparing');let sent=0;
  const route=load('app/api/admin/orders/[id]/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true,sendSMS:async()=>{assert.equal((await native('SELECT status FROM orders')).rows[0].status,'shipped');sent++;return {ok:true};}}});
  const body={status:'shipped',tracking_company:'05',tracking_number:'123456789012'};
  const res=await route.PATCH(req('/x','PATCH',body),ctx(10));assert.equal(res.status,200);assert.equal(sent,1);
  assert.equal((await route.PATCH(req('/x','PATCH',body),ctx(10))).status,409);assert.equal(sent,1);assert.equal((await query('SELECT count(*)::int n FROM shipment_notifications')).rows[0].n,1);
 });
 test(`${scope}: partial return rejects excess quantity and supports the final return`,async()=>{
  await readyOrder(scope,'delivered');await query('UPDATE order_items SET quantity=2,unit_price=50000');const item=(await query('SELECT id FROM order_items')).rows[0];
  const customer=customerApi('return'),body={kind:'return',reason:'상품 불량·파손',items:[{item_id:item.id,quantity:1}]};
  assert.equal((await customer.POST(req('/x','POST',body),ctx(10))).status,200);
  let refund=0;global.fetch=async()=>{refund+=50000;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:100000-refund,status:refund===100000?'CANCELED':'PARTIAL_CANCELED'});};
  const first=(await query("SELECT id FROM order_returns WHERE status='requested'")).rows[0];assert.equal((await api('admin/returns').PATCH(req('/x','PATCH',{id:first.id,action:'complete',refund_amount:50000}))).status,200);
  const available=await load('lib/return-quantities.ts',mocks).returnableItems(pool,id(10));assert.equal(available[0].quantity,1);
  assert.equal((await customer.POST(req('/x','POST',{...body,items:[{item_id:item.id,quantity:2}]}),ctx(10))).status,400);
  const a=customer.POST(req('/x','POST',body),ctx(10)),b=customer.POST(req('/x','POST',body),ctx(10));const responses=await Promise.all([a,b]);assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  const second=(await query("SELECT id FROM order_returns WHERE status='requested'")).rows[0];assert.equal((await api('admin/returns').PATCH(req('/x','PATCH',{id:second.id,action:'complete',refund_amount:50000}))).status,200);
  assert.equal((await load('lib/return-quantities.ts',mocks).returnableItems(pool,id(10))).length,0);assert.equal((await customer.POST(req('/x','POST',body),ctx(10))).status,400);assert.equal(refund,100000);
 });
 test(`${scope}: completed exchange can be followed by a return`,async()=>{
  await readyOrder(scope,'delivered');const item=(await query('SELECT id FROM order_items')).rows[0];const customer=customerApi('return');const body={kind:'exchange',reason:'상품 불량·파손',items:[{item_id:item.id,quantity:1}]};
  assert.equal((await customer.POST(req('/x','POST',body),ctx(10))).status,200);const ret=(await query('SELECT id FROM order_returns')).rows[0];assert.equal((await api('admin/returns').PATCH(req('/x','PATCH',{id:ret.id,action:'complete'}))).status,200);
  assert.equal((await customer.POST(req('/x','POST',{...body,kind:'return'}),ctx(10))).status,200);
 });
 for(const kind of ['shop','cart','campaign']) test(`${scope}: ${kind} checkout validates all required contact fields before PG`,async()=>{
  site=scope;await product();let calls=0;global.fetch=async()=>{calls++;throw Error('PG must not be called');};
  const route=api(kind==='campaign'?'payment/confirm':`payment/${kind}-confirm`);
  for(const patch of [{customerName:''},{customerPhone:'abc'},{shippingZipcode:''},{shippingAddress:'   '},{shippingName:8},{shippingPhone:'x'},{shippingAddress2:['wrong']}]) {
   const data=checkout();Object.assign(data.checkoutData,require('./support/checkout-contact.cjs'),patch);const result=await route.POST(req('/x','POST',data));assert.equal(result.status,400,JSON.stringify(patch));
  }
  assert.equal(calls,0);assert.equal((await query('SELECT count(*)::int n FROM payment_attempts')).rows[0].n,0);assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,20);
 });
}
