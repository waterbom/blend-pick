// Regression coverage for the six full-process audit findings.
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
before(async()=>{await setup(db,id);await db.exec("ALTER TABLE orders ADD COLUMN stay_check_in date; ALTER TABLE orders ADD COLUMN stay_check_out date; CREATE TABLE hotel_room_inventory(stay_date date,room_type text,booked int); ALTER TABLE products ADD COLUMN brand text, ADD COLUMN product_image text, ADD COLUMN category text, ADD COLUMN consumer_price int, ADD COLUMN groupbuy_price int, ADD COLUMN set_options jsonb, ADD COLUMN shipping_type text, ADD COLUMN shipping_cost int, ADD COLUMN status text, ADD COLUMN visibility_status text; ALTER TABLE campaigns ADD COLUMN is_archived boolean DEFAULT false, ADD COLUMN supply_price int;");});
beforeEach(async()=>{site='sanjipick';auth=true;hook=null;global.fetch=async()=>{throw Error('UNMOCKED NETWORK BLOCKED');};await db.exec('TRUNCATE products,campaigns,payment_attempts,products_shop,product_options,product_addons,orders,order_items,settlements,campaign_costs,influencer_payouts,product_secret_links,order_refund_amounts,product_images,order_returns,order_return_events,hotel_room_inventory CASCADE');});
after(async()=>{global.fetch=originalFetch;if(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.ADMIN_REVIEW_OBSERVATIONS_PATH,JSON.stringify(observations,null,2));await db.close();});
async function product(n=1,price=100000,stock=20){await query("INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,supply_price,influencer_rate,influencer_id,tax_type) VALUES($1,$2,'산지픽',$3,$4,'active',true,'free',0,20000,10,$5,'taxable')",[id(n),'상품'+n,price,stock,id(999)]);}
async function order(n=10,total=100000,status='paid',pid=1){await query("INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key,payment_method,influencer_id,influencer_name,commission_rate) VALUES($1,'sanjipick','shop',$2,NOW(),$3,$4,0,$5,'계좌이체',$6,'테스트 인플루언서',10)",[id(n),'ORDER'+n,status,total,'mock-'+n,id(999)]);if(pid!==null)await query("INSERT INTO order_items(order_id,product_id,product_ref,product_name,quantity,unit_price,supply_price,tax_type) VALUES($1,$2,$2,$3,1,$4,20000,'taxable')",[id(n),id(pid),'상품'+pid,total]);}

for (const key of ['blendpick','sanjipick']) {
  async function seed(status='paid') { site=key;await product();await order(10,100000,status);await native('UPDATE orders SET site=$1,buyer_phone=$2',[key,'01000000000']); }
  test(`${key}: full manual paid-confirmed-preparing-shipped-delivered flow settles exactly once`,async()=>{
    await seed();const route=api('admin/orders/[id]');
    for(const status of ['confirmed','preparing','shipped','delivered']) {
      const res=await route.PATCH(req('/x','PATCH',{status,...(status==='shipped'?{tracking_company:'04',tracking_number:'001234567890'}:{})}),ctx(10));
      assert.equal(res.status,200,await res.text());
    }
    const again=await route.PATCH(req('/x','PATCH',{status:'delivered'}),ctx(10));assert.equal(again.status,409);
    const saved=(await native('SELECT status,tracking_number FROM orders')).rows[0];
    assert.deepEqual(saved,{status:'delivered',tracking_number:'001234567890'});
    assert.equal((await native('SELECT COUNT(*)::int AS n FROM settlements')).rows[0].n,1);
  });
  for(const value of ['---','6.99528E+11']) test(`${key}: manual invoice registration rejects invalid ${value}`,async()=>{
    await seed();const res=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'04',tracking_number:value}),ctx(10));
    const saved=(await native('SELECT status,tracking_number FROM orders')).rows[0];observe('invalid-manual-invoice',{site:key,input:value,http:res.status,saved});
    assert.ok([400,409].includes(res.status),'invalid invoice must be rejected before marking shipped');assert.equal(saved.status,'paid');
  });
  test(`${key}: missing-invoice repair rejects malformed invoice`,async()=>{
    await seed('shipped');const res=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{action:'repair_tracking',tracking_company:'04',tracking_number:'---'}),ctx(10));
    observe('invalid-repair',{site:key,http:res.status,saved:(await native('SELECT tracking_number FROM orders')).rows[0]});assert.equal(res.status,400);
  });
  test(`${key}: conflicting duplicate rows must not notify a different invoice from the saved one`,async()=>{
    await seed();const sent=[];const route=load('app/api/admin/shipments/import/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true},'@/lib/ship-notify':{sendShipmentSMS:async(_,v)=>{sent.push(v.trackingNumber);return {ok:true};}}});
    const res=await route.POST(req('/x','POST',{rows:['111111111111','222222222222'].map(tracking_number=>({order_number:'ORDER10',carrier:'04',tracking_number}))}));
    const body=await res.json(),saved=(await native('SELECT tracking_number FROM orders')).rows[0].tracking_number;
    observe('conflicting-duplicate-invoices',{site:key,http:res.status,body,sent,saved});assert.equal(res.status,400);assert.equal(sent.length,0);assert.equal(saved,null);assert.equal((await native('SELECT status FROM orders')).rows[0].status,'paid');
  });
  test(`${key}: batch DB failure rolls back all rows and sends no SMS`,async()=>{
    await seed();await order(11);await native('UPDATE orders SET site=$1',[key]);let sent=0;
    const route=load('app/api/admin/shipments/import/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true},'@/lib/ship-notify':{sendShipmentSMS:async()=>{sent++;return{ok:true};}}});
    hook=async(sql,p,run)=>{if(sql.includes('UPDATE orders')&&p[0]==='ORDER11')throw Error('INJECTED_DB_FAILURE');return run(sql,p);};
    const res=await route.POST(req('/x','POST',{rows:[10,11].map(n=>({order_number:'ORDER'+n,carrier:'04',tracking_number:'001234567890'}))}));hook=null;
    assert.equal(res.status,500);assert.equal(sent,0);assert.ok((await native('SELECT status,tracking_number FROM orders')).rows.every(o=>o.status==='paid'&&o.tracking_number===null));
  });
  test(`${key}: shipment SMS failure remains reported and reimport does not resend`,async()=>{
    await seed();let calls=0;const route=load('app/api/admin/shipments/import/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true},'@/lib/ship-notify':{sendShipmentSMS:async()=>{calls++;return{ok:false,error:'INJECTED_SMS_FAILURE'};}}});
    const body={rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'001234567890'}]};
    const first=await(await route.POST(req('/x','POST',body))).json(),retry=await(await route.POST(req('/x','POST',body))).json();
    observe('sms-recovery-limitation',{site:key,first,retry,calls});assert.equal(first.smsFailed,1);assert.equal(first.succeeded,1);assert.equal(calls,1);assert.equal(retry.smsSent,0);
  });
  test(`${key}: terminal states cannot be shipped again`,async()=>{
    await seed();for(const status of ['cancelled','returned','delivered','return_requested','cancel_requested']) {
      await native('UPDATE orders SET status=$1',[status]);const res=await api('admin/orders/[id]').PATCH(req('/x','PATCH',{status:'shipped',tracking_company:'04',tracking_number:'001234567890'}),ctx(10));assert.equal(res.status,409);assert.equal((await native('SELECT status FROM orders')).rows[0].status,status);
    }
  });
}
test('shipment import null body responds with a client error',async()=>{
  let result;try{result=await api('admin/shipments/import').POST(req('/x','POST',null));}catch(e){observe('null-import-body',{exception:e.name,message:e.message});throw e;}
  assert.equal(result.status,400);
});

// Legacy campaign checkout is still called by app/checkout/success/page.tsx.
for (const key of ['blendpick','sanjipick']) {
  async function seedCampaign(){site=key;await product();await native("INSERT INTO products(id,name,category,consumer_price,groupbuy_price,shipping_type,shipping_cost,status,visibility_status) VALUES($1,'DB 상품',$2,100000,90000,'free',0,'active','active')",[id(1),key==='sanjipick'?'산지픽':'생활']);}
  function payload(){return {paymentKey:'isolated-campaign-key',orderId:'isolated-campaign-order',amount:90000,checkoutData:{productId:id(1),productName:'격리 테스트 상품',quantity:1,unitPrice:90000,totalAmount:90000,shippingCost:0,customerName:'가상 구매자',customerPhone:'01000000000',shippingAddress:'격리 테스트 주소'}};}
  function provider(counter){let approved;global.fetch=async(url,options)=>{const method=options?.method||'GET';if(method==='POST'){assert.equal(url,'https://api.tosspayments.com/v1/payments/confirm');const b=JSON.parse(options.body);counter.push({...b,method});approved={method:'카드',status:'DONE',totalAmount:b.amount,paymentKey:b.paymentKey,orderId:b.orderId};}else{assert.equal(url,'https://api.tosspayments.com/v1/payments/isolated-campaign-key');counter.push({method});}return Response.json(approved);};}
  test(`${key}: campaign rejects coherent underpricing, bad option, wrong site and inactive product before PG`,async()=>{
    await seedCampaign();const calls=[];provider(calls);const route=api('payment/confirm');
    const low=payload();low.amount=low.checkoutData.totalAmount=low.checkoutData.unitPrice=100;
    assert.equal((await route.POST(req('/x','POST',low))).status,400);
    const bad=payload();bad.checkoutData.optionIndex=99;assert.equal((await route.POST(req('/x','POST',bad))).status,400);
    await native('UPDATE products SET category=$1',[key==='sanjipick'?'생활':'산지픽']);assert.equal((await route.POST(req('/x','POST',payload()))).status,400);
    await native("UPDATE products SET category=$1,status='paused'",[key==='sanjipick'?'산지픽':'생활']);assert.equal((await route.POST(req('/x','POST',payload()))).status,400);
    assert.equal(calls.length,0);assert.equal((await native('SELECT COUNT(*)::int AS n FROM payment_attempts')).rows[0].n,0);
  });
  test(`${key}: selected campaign option, shipping and partner data are saved from the OS database`,async()=>{
    await seedCampaign();const calls=[];provider(calls);
    await native("UPDATE products SET set_options=$1,shipping_type='paid',shipping_cost=3000",[JSON.stringify([{name:'DB 묶음',price:170000}])]);
    await native("INSERT INTO campaigns(id,product_id,influencer_id,commission_rate,supply_price,start_date,end_date) VALUES($1,$2,$3,7,120000,CURRENT_DATE-1,CURRENT_DATE+1)",[id(90),id(1),id(999)]);
    const d=payload();Object.assign(d.checkoutData,{optionIndex:0,quantity:2,unitPrice:170000,shippingCost:3000,totalAmount:343000,campaignId:id(90),influencerId:id(123),influencerName:'위조'});d.amount=343000;
    const res=await api('payment/confirm').POST(req('/x','POST',d));assert.equal(res.status,200,await res.text());
    const o=(await native('SELECT * FROM orders')).rows[0],i=(await native('SELECT * FROM order_items')).rows[0];
    assert.equal(o.total_amount,343000);assert.equal(o.shipping_fee,3000);assert.equal(o.campaign_id,id(90));assert.equal(o.influencer_id,id(999));assert.equal(o.order_type,'campaign');assert.equal(o.site,key);
    assert.equal(i.product_id,null);assert.equal(i.product_ref,id(1));assert.equal(i.product_name,'DB 상품');assert.equal(i.option_label,'DB 묶음');assert.equal(i.unit_price,170000);assert.equal(i.quantity,2);assert.equal(Number(i.commission_rate),7);assert.equal(i.supply_price,120000);
    assert.equal((await native('SELECT stock FROM products_shop')).rows[0].stock,20);
  });
  test(`${key}: expired or mismatched campaign attribution is rejected before approval`,async()=>{
    await seedCampaign();const calls=[];provider(calls);const d=payload();d.checkoutData.campaignId=id(90);
    await native("INSERT INTO campaigns(id,product_id,influencer_id,start_date,end_date) VALUES($1,$2,$3,CURRENT_DATE-3,CURRENT_DATE-1)",[id(90),id(1),id(999)]);
    assert.equal((await api('payment/confirm').POST(req('/x','POST',d))).status,400);
    await native('UPDATE campaigns SET end_date=CURRENT_DATE+1,product_id=$1',[id(2)]);assert.equal((await api('payment/confirm').POST(req('/x','POST',d))).status,400);assert.equal(calls.length,0);
  });
  test(`${key}: simultaneous campaign callbacks approve once and changed retries cannot reuse the attempt`,async()=>{
    await seedCampaign();const calls=[];provider(calls);const route=api('payment/confirm'),d=payload();
    const results=await Promise.all([route.POST(req('/x','POST',d)),route.POST(req('/x','POST',d))]);assert.ok(results.every(r=>[200,409].includes(r.status)));assert.ok(results.some(r=>r.status===200));
    assert.equal((await route.POST(req('/x','POST',d))).status,200);assert.equal(calls.length,1);assert.equal((await native('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n,1);
    const altered=payload();altered.checkoutData.customerName='다른 구매자';assert.equal((await route.POST(req('/x','POST',altered))).status,409);
    site=key==='sanjipick'?'blendpick':'sanjipick';assert.equal((await route.POST(req('/x','POST',d))).status,409);assert.equal(calls.length,1);
  });
  test(`${key}: failed campaign attempt creation cannot reach payment approval`,async()=>{
    await seedCampaign();const calls=[];provider(calls);hook=async(sql,p,run)=>{if(sql.includes('INSERT INTO payment_attempts'))throw Error('INJECTED_ATTEMPT_FAILURE');return run(sql,p);};
    const res=await api('payment/confirm').POST(req('/x','POST',payload()));hook=null;assert.equal(res.status,503);assert.equal(calls.length,0);assert.equal((await native('SELECT COUNT(*)::int AS n FROM payment_attempts')).rows[0].n,0);
  });
  test(`${key}: campaign form sends option identity and phone requirement matching the approval handler`,async()=>{
    await seedCampaign();await native('UPDATE products SET set_options=$1',[JSON.stringify([{name:'2박스',price:170000}])]);
    const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
    const render=async loggedIn=>{
      const page=load('app/campaigns/[id]/checkout/page.tsx',{...mocks,'@/lib/auth':{...mocks['@/lib/auth'],verifyToken:async()=>loggedIn?{id:id(888)}:null},'@/lib/sms':{phoneVerifyOn:()=>true},'@/components/CheckoutClient':props=>React.createElement('div',{'data-option':props.optionIndex,'data-unit':props.unitPrice,'data-phone':String(props.phoneVerifyRequired)})});
      return renderToStaticMarkup(await page.default({params:Promise.resolve({id:id(1)}),searchParams:Promise.resolve({opt:'0',qty:'2'})}));
    };
    const guest=await render(false),member=await render(true);assert.match(guest,/data-option="0"/);assert.match(guest,/data-unit="170000"/);assert.match(guest,/data-phone="true"/);assert.match(member,/data-phone="false"/);
    const calls=[];provider(calls);const route=load('app/api/payment/confirm/route.ts',{...mocks,'@/lib/sms':{phoneVerifyOn:()=>true}});
    assert.equal((await route.POST(req('/x','POST',payload()))).status,403);assert.equal(calls.length,0);
    const verified=load('app/api/payment/confirm/route.ts',{...mocks,'@/lib/sms':{phoneVerifyOn:()=>true},'@/lib/phone-verify':{isPhoneVerified:async()=>true}});
    assert.equal((await verified.POST(req('/x','POST',payload()))).status,200);assert.equal(calls.length,1);
  });
  test(`${key}: legacy campaign rejects client amount below stored product price before approval`,async()=>{
    await seedCampaign();const calls=[];provider(calls);const data=payload();data.amount=100;const res=await api('payment/confirm').POST(req('/x','POST',data));
    const saved=(await native('SELECT total_amount,status FROM orders')).rows;
    observe('legacy-campaign-underpayment',{site:key,http:res.status,providerAmounts:calls.map(v=>v.amount),saved});assert.equal(res.status,400);assert.equal(saved.length,0);assert.equal(calls.length,0,'server must verify the price before approving payment');
  });
  test(`${key}: legacy campaign storage failure must not report a completed order`,async()=>{
    await seedCampaign();const calls=[];provider(calls);hook=async(sql,p,run)=>{if(sql.includes('INSERT INTO order_items'))throw Error('INJECTED_ORDER_STORAGE_FAILURE');return run(sql,p);};
    const res=await api('payment/confirm').POST(req('/x','POST',payload()));hook=null;const body=await res.json();const count=(await native('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n;
    observe('legacy-campaign-storage-failure',{site:key,http:res.status,ok:body.ok,orderCount:count,approvalCalls:calls.length});assert.notEqual(body.ok,true,'paid but unstored order must require recovery instead of success');assert.equal(res.status,503);assert.equal(count,0);assert.equal(calls.length,1);
    assert.equal((await native('SELECT status FROM payment_attempts')).rows[0].status,'needs_review');
    const queue=await(await api('admin/payment-recovery').GET()).json();assert.equal(queue.length,1);
    const recovered=await api('admin/payment-recovery').POST(req('/x','POST',{orderId:'isolated-campaign-order'}));assert.equal(recovered.status,200,await recovered.text());
    assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(calls.filter(c=>c.method==='GET').length,1);
    assert.equal((await native('SELECT COUNT(*)::int AS n FROM orders')).rows[0].n,1);assert.equal((await native('SELECT stock FROM products_shop')).rows[0].stock,20);
    assert.equal((await native('SELECT order_type FROM orders')).rows[0].order_type,'campaign');
  });
  test(`${key}: replay of approved legacy campaign must not create duplicate orders`,async()=>{
    await seedCampaign();const calls=[];provider(calls);const route=api('payment/confirm');
    const first=await route.POST(req('/x','POST',payload())),second=await route.POST(req('/x','POST',payload()));
    const count=(await native('SELECT COUNT(*)::int AS n FROM orders WHERE payment_key=$1',['isolated-campaign-key'])).rows[0].n;
    observe('legacy-campaign-approved-replay',{site:key,http:[first.status,second.status],orderCount:count,approvalCalls:calls.length});assert.equal(first.status,200,await first.text());assert.equal(second.status,200,await second.text());assert.equal(count,1,'one provider payment must map to only one order');assert.equal(calls.length,1);
  });
}

test('shipment malformed bodies are rejected before DB writes and authentication still runs first',async()=>{
  const route=api('admin/shipments/import');
  for(const raw of ['{','null','[]','true','"text"','{}','{"rows":null}']) {
    const request=new NextRequest('https://sanjipick.blendpunch.com/x',{method:'POST',headers:{'content-type':'application/json'},body:raw});
    assert.equal((await route.POST(request)).status,400);
  }
  auth=false;assert.equal((await route.POST(req('/x','POST',null))).status,401);
});
test('duplicate whitespace-normalized order numbers reject the entire upload before unrelated rows change',async()=>{
  await product();await order();await order(11);const route=api('admin/shipments/import');
  const rows=['ORDER11',' ORDER10 ','ORDER10'].map(order_number=>({order_number,carrier:'04',tracking_number:'001234567890'}));
  assert.equal((await route.POST(req('/x','POST',{rows}))).status,400);
  assert.ok((await native('SELECT status,tracking_number FROM orders')).rows.every(r=>r.status==='paid'&&r.tracking_number===null));
});
test('manual invoice validation normalizes legacy carrier and preserves leading zero and explicit no-invoice workflow',async()=>{
  await product();await order();const route=api('admin/orders/[id]');
  for(const body of [{tracking_company:'unknown',tracking_number:'123'},{tracking_company:'04',tracking_number:123},{tracking_company:'04',tracking_number:'1'.repeat(101)},{tracking_number:'123'}]) {
    assert.equal((await route.PATCH(req('/x','PATCH',{status:'shipped',...body}),ctx(10))).status,400);
  }
  assert.equal((await route.PATCH(req('/x','PATCH',{status:'shipped',tracking_company:' cj ',tracking_number:' 00123-456 '}),ctx(10))).status,200);
  assert.deepEqual((await native('SELECT tracking_company,tracking_number FROM orders')).rows[0],{tracking_company:'04',tracking_number:'00123-456'});
  await order(11,100000,'preparing');assert.equal((await route.PATCH(req('/x','PATCH',{status:'shipped'}),ctx(11))).status,200);
});
