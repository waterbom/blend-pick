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

test('B1 definitive rejected payment must not strand the last unit indefinitely',async()=>{
 await product(1,100000,1);let externalCalls=0;global.fetch=async(url,opts)=>{externalCalls++;return opts.method==='POST'?Response.json({code:'INVALID_REQUEST',message:'존재하지 않는 결제'}, {status:400}):Response.json({code:'NOT_FOUND_PAYMENT',message:'결제 없음'},{status:404});};
 const d=checkout();const result=await api('payment/shop-confirm').POST(req('/x','POST',d));
 const recover=await api('admin/payment-recovery').POST(req('/x','POST',{orderId:d.orderId}));
 const state=(await query('SELECT status,last_error FROM payment_attempts')).rows[0];const stock=(await query('SELECT stock FROM products_shop')).rows[0].stock;
 observe('B1',{checkoutStatus:result.status,recoveryStatus:recover.status,stock,attemptStatus:state.status,orders:(await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,externalCalls});
 assert.equal(stock,1,'승인 자체가 존재하지 않는 실패 건의 예약 해제 경로가 필요하다');
});

test('B2 removing every option must allow switching back to a simple product',async()=>{
 const body=baseForm({options:[{name:'기존 옵션',price:100000,stock:10,supply_price:20000}]});const {pid,context}=await createForm(body);const route=api('admin/products/[id]');
 const read=await (await route.GET(req(),context)).json();const saved=await route.PATCH(req('/x','PATCH',{...body,options:[],stock:10,expected_updated_at:read.updated_at}),context);assert.equal(saved.status,200);
 const verify=await load('lib/order-amount.ts',mocks).verifySingleAmount({site,productId:pid,quantity:1,unitPrice:100000,totalAmount:100000,shippingCost:0,amount:100000});
 const options=(await query('SELECT is_active FROM product_options WHERE product_id=$1',[pid])).rows;
 observe('B2',{saveStatus:saved.status,storedOptions:options,verification:verify});assert.equal(verify.ok,true,'비활성 보관 옵션 때문에 본상품 구매가 막히면 안 된다');
});

test('B3 issuing a link in the edit form must not invalidate that same form version',async()=>{
 const body=baseForm({link_price:80000,link_start_at:new Date(Date.now()-60000).toISOString(),link_end_at:new Date(Date.now()+3600000).toISOString()});const {pid,context}=await createForm(body);const detail=api('admin/products/[id]');
 const read=await (await detail.GET(req(),context)).json();const issued=await api('admin/products/[id]/secret-link').POST(req('/x','POST',{}),context);assert.equal(issued.status,200);const issuedData=await issued.json();
 const saved=await detail.PATCH(req('/x','PATCH',{...body,name:'같은 화면에서 이름 수정',expected_updated_at:issuedData.updated_at??read.updated_at}),context);const response=await saved.json();
 // UI issueLink/revokeLink only update linkCode; neither updates loadedVersion.
 observe('B3',{issueStatus:issued.status,saveStatus:saved.status,response});assert.equal(saved.status,200);
});

test('B4 partial return retry after DB failure must not refund twice',async()=>{
 await product();await order(10,100000,'return_requested');await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'return','collecting','delivered','일부 반품')",[id(50),id(10)]);
 let actualRefunded=0,calls=0;global.fetch=async(url,opts)=>{assert.ok(url.endsWith('/cancel'));const b=JSON.parse(opts.body);const n=b.cancelAmount??100000;assert.ok(actualRefunded+n<=100000);actualRefunded+=n;calls++;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:100000-actualRefunded,status:'PARTIAL_CANCELED'});};
 let fail=true;hook=async(sql,p,run)=>{if(fail&&sql.includes("UPDATE order_returns SET status = 'done'")){fail=false;throw Error('Injected failure after PG refund');}return run(sql,p);};
 const route=api('admin/returns'),body={id:id(50),action:'complete',refund_amount:20000};const first=await route.PATCH(req('/x','PATCH',body));hook=null;
 const second=await route.PATCH(req('/x','PATCH',body));const recorded=Number((await query('SELECT COALESCE(SUM(amount),0) amount FROM order_refund_amounts')).rows[0].amount);
 observe('B4',{first:first.status,retry:second.status,mockedRefunded:actualRefunded,ledgerRefunded:recorded,providerCalls:calls});assert.equal(actualRefunded,20000,'동일 반품 완료 재시도는 첫 환불 결과를 복구해야 한다');assert.equal(recorded,actualRefunded);
});

test('B5 retrying cancellation with changed shipping deduction must use actual cached refund amount',async()=>{
 await product();await order(10,103000,'cancel_requested');await query('UPDATE orders SET shipping_fee=3000');
 let cached=null,charged=0;global.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(!cached){charged=body.cancelAmount;cached={paymentKey:'mock-10',totalAmount:103000,balanceAmount:103000-charged,status:'PARTIAL_CANCELED',cancels:[{cancelAmount:charged}]};}return Response.json(cached);};
 let fail=true;hook=async(sql,p,run)=>{if(fail&&sql.includes("UPDATE orders SET status='cancelled'")){fail=false;throw Error('Injected cancellation DB failure');}return run(sql,p);};
 const cancel=load('lib/order-cancel.ts',mocks).cancelShopOrder;const first=await cancel(id(10),'취소',{deductShipping:true,site});hook=null;const second=await cancel(id(10),'취소',{deductShipping:false,site});
 const recorded=Number((await query('SELECT SUM(amount) amount FROM order_refund_amounts')).rows[0].amount);
 observe('B5',{firstOk:first.ok,retryOk:second.ok,mockedRefunded:charged,ledgerRefunded:recorded});assert.equal(recorded,charged,'멱등키의 이전 응답을 새 요청 금액으로 기록하면 안 된다');
});

test('B6 refund committed between payout check and update must prevent stale paid confirmation',async()=>{
 await product();await order();const fixed=await confirm(1);const payoutId=(await fixed.json()).id;let injected=false;
 hook=async(sql,p,run)=>{if(!injected&&sql.includes('UPDATE influencer_payouts SET status=$1')){injected=true;await native("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('concurrent',$1,20000)",[id(10)]);}return run(sql,p);};
 const res=await api('admin/influencer-payouts/[id]').PATCH(req('/x','PATCH',{status:'paid'}),{params:Promise.resolve({id:payoutId})});hook=null;
 const state=(await query('SELECT status,commission FROM influencer_payouts WHERE id=$1',[payoutId])).rows[0];const current=(await inf())[0].commission;
 observe('B6',{response:res.status,payout:state,currentCommission:current,interleaving:'payout validation → refund commit → payout status write'});assert.equal(res.status,409);
});

test('B7 hotel cancellation must feed the refund ledger used by the new financial reports',async()=>{
 await product();await order(10,100000,'paid');site='blendpick';await query("UPDATE orders SET site='blendpick',order_type='hotel',commission_rate=5,stay_check_in='2030-10-01',stay_check_out='2030-10-02'");await query("UPDATE order_items SET option_label='룸A · 1박'");await query("INSERT INTO hotel_room_inventory(stay_date,room_type,booked) VALUES('2030-10-01','룸A',1)");
 let refunded=0;global.fetch=async(url,opts)=>{assert.ok(url.endsWith('/cancel'));refunded=JSON.parse(opts.body).cancelAmount??100000;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};
 const res=await load('lib/hotel-cancel.ts',mocks).cancelHotelReservation(id(10),{fullRefund:true,reasonPrefix:'관리자 취소'});assert.equal(res.ok,true);
 const row=(await profit())[0],ledger=(await query('SELECT COUNT(*)::int n FROM order_refund_amounts')).rows[0].n;
 observe('B7',{mockedRefunded:refunded,ledgerRows:ledger,profitGross:row.gross,reportedRefunds:row.refunds,profitReview:row.review_reasons});assert.equal(row.gross,0);
});

test('B8 repeated successful confirmation must preserve the payment-method response',async()=>{
 await product();const d=checkout(),route=api('payment/shop-confirm');mockApprove();const first=await route.POST(req('/x','POST',d));const second=await route.POST(req('/x','POST',d));
 const initial=await first.json(),repeated=await second.json();observe('B8',{firstMethod:initial.paymentMethod,repeatedMethod:repeated.paymentMethod??null,firstOrder:initial.orderNumber,repeatedOrder:repeated.orderNumber});
 assert.equal(repeated.paymentMethod,initial.paymentMethod,'재시도 응답에도 결제수단이 유지되어야 한다');
});

test('G1 option rename retains identity and rejects stale item prices before contacting PG',async()=>{
 const body=baseForm({options:[{name:'3kg',price:100000,stock:10,supply_price:20000}]});const {pid,context}=await createForm(body);const route=api('admin/products/[id]');const read=await (await route.GET(req(),context)).json();
 const save=await route.PATCH(req('/x','PATCH',{...body,options:[{...body.options[0],id:read.options[0].id,name:'3kg 선물세트',price:110000}],expected_updated_at:read.updated_at}),context);assert.equal(save.status,200);
 const changed=await (await route.GET(req(),context)).json();assert.equal(changed.options[0].id,read.options[0].id);
 let calls=0;global.fetch=async()=>{calls++;throw Error('Must not reach PG');};const d=checkout();d.checkoutData.productId=pid;d.checkoutData.optionId=read.options[0].id;assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',d))).status,400);assert.equal(calls,0);
 observe('G1',{optionIdPreserved:true,stalePriceRejected:true,providerCalls:calls});
});

test('G2 simultaneous recovery requests create a single order and deduct stock once',async()=>{
 await product(1,100000,2);const d=checkout();global.fetch=async()=>{throw Error('unknown approval response');};assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',d))).status,503);
 let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);let calls=0;global.fetch=async(url,opts)=>{assert.equal(opts.method,'GET');calls++;enter();await gate;return Response.json({paymentKey:d.paymentKey,orderId:d.orderId,totalAmount:100000,status:'DONE',method:'카드'});};
 const route=api('admin/payment-recovery'),one=route.POST(req('/x','POST',{orderId:d.orderId}));await ready;const two=await route.POST(req('/x','POST',{orderId:d.orderId}));release();const a=await one;
 const orders=(await query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,stock=(await query('SELECT stock FROM products_shop')).rows[0].stock;
 assert.equal(a.status,200);assert.equal(two.status,409);assert.equal(orders,1);assert.equal(stock,1);assert.equal(calls,1);observe('G2',{statuses:[a.status,two.status],orders,stock,lookupCalls:calls});
});

test('G3 refund allocation preserves totals for 1000 varying item lists',()=>{
 const {allocate}=load('lib/order-finance.ts',mocks);let seed=33;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
 for(let t=0;t<1000;t++){const weights=Array.from({length:1+rand()%12},()=>1+rand()%1000000);const total=rand()%2000000000,result=allocate(total,weights);assert.equal(result.reduce((a,b)=>a+b,0),total);assert.ok(result.every(v=>Number.isSafeInteger(v)&&v>=0));}
 observe('G3',{cases:1000,totalPreserved:true});
});

test('G4 rejected cancellation leaves status, stock and financial ledger unchanged',async()=>{
 await product();await order();global.fetch=async()=>Response.json({message:'거절'},{status:400});
 const cancel=await load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'관리자취소',{site});assert.equal(cancel.ok,false);
 assert.equal((await query('SELECT status FROM orders')).rows[0].status,'paid');assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,20);assert.equal((await query('SELECT COUNT(*)::int n FROM order_refund_amounts')).rows[0].n,0);
 observe('G4',{orderPreserved:true,stockPreserved:true,refundLedgerUnchanged:true});
});

test('H1 lost refund-result storage reuses the original provider key and amount',async()=>{
 await product();await order(10,100000,'return_requested');await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'return','collecting','delivered','반품')",[id(50),id(10)]);
 const cache=new Map();let refunded=0,posts=0;global.fetch=async(url,opts)=>{posts++;const key=opts.headers['Idempotency-Key'];assert.ok(key);const body=JSON.parse(opts.body);if(!cache.has(key)){refunded+=body.cancelAmount;cache.set(key,{paymentKey:'mock-10',totalAmount:100000,balanceAmount:100000-refunded,status:'PARTIAL_CANCELED'});}return Response.json(cache.get(key));};
 let once=true;hook=async(sql,p,run)=>{if(once&&sql.includes("SET status='succeeded'")){once=false;throw Error('lost refund result write');}return run(sql,p);};
 const route=api('admin/returns'),body={id:id(50),action:'complete',refund_amount:20000};assert.equal((await route.PATCH(req('/x','PATCH',body))).status,500);hook=null;
 assert.equal((await route.PATCH(req('/x','PATCH',{...body,refund_amount:30000}))).status,200);
 assert.equal(posts,2);assert.equal(cache.size,1);assert.equal(refunded,20000);assert.equal(Number((await query('SELECT SUM(amount) n FROM order_refund_amounts')).rows[0].n),20000);
});

test('H2 concurrent return completion and rejection cannot duplicate or undo a refund',async()=>{
 await product();await order(10,100000,'return_requested');await query("INSERT INTO order_returns(id,order_id,kind,status,prev_status,reason) VALUES($1,$2,'return','collecting','delivered','반품')",[id(50),id(10)]);
 let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);let calls=0;global.fetch=async()=>{calls++;enter();await gate;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:80000,status:'PARTIAL_CANCELED'});};
 const route=api('admin/returns'),body={id:id(50),action:'complete',refund_amount:20000};const first=route.PATCH(req('/x','PATCH',body));await ready;
 assert.equal((await route.PATCH(req('/x','PATCH',body))).status,409);
 assert.equal((await route.PATCH(req('/x','PATCH',{id:id(50),action:'reject'}))).status,409);
 release();assert.equal((await first).status,200);assert.equal(calls,1);assert.equal((await query('SELECT status FROM order_returns')).rows[0].status,'done');
});

test('H3 pending external refund prevents marking a previously confirmed payout paid',async()=>{
 await product();await order();const payout=(await (await confirm(1)).json()).id;
 let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);global.fetch=async()=>{enter();await gate;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};
 const cancel=load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'취소',{site});await ready;
 const paid=await api('admin/influencer-payouts/[id]').PATCH(req('/x','PATCH',{status:'paid'}),{params:Promise.resolve({id:payout})});assert.equal(paid.status,409);
 release();assert.equal((await cancel).ok,true);assert.equal((await query('SELECT status FROM influencer_payouts')).rows[0].status,'pending');
});

test('H4 ambiguous approval timeout plus missing lookup retains stock for reconciliation',async()=>{
 await product(1,100000,1);const d=checkout();global.fetch=async()=>{throw Error('timeout');};assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',d))).status,503);
 global.fetch=async()=>Response.json({code:'NOT_FOUND_PAYMENT'},{status:404});assert.equal((await api('admin/payment-recovery').POST(req('/x','POST',{orderId:d.orderId}))).status,409);
 assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,0);assert.equal((await query('SELECT status FROM payment_attempts')).rows[0].status,'needs_review');
});

test('H5 definitive rejection survives a temporary lookup failure and releases exactly once later',async()=>{
 await product(1,100000,1);const d=checkout();global.fetch=async(url,opts)=>opts.method==='POST'?Response.json({code:'REJECT_CARD_COMPANY'},{status:403}):Response.json({code:'COMMON_ERROR'},{status:500});
 assert.equal((await api('payment/shop-confirm').POST(req('/x','POST',d))).status,409);assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,0);
 global.fetch=async()=>Response.json({code:'NOT_FOUND_PAYMENT'},{status:404});const route=api('admin/payment-recovery');await route.POST(req('/x','POST',{orderId:d.orderId}));await route.POST(req('/x','POST',{orderId:d.orderId}));
 assert.equal((await query('SELECT stock FROM products_shop')).rows[0].stock,1);
});

test('H6 link revocation returns an editable version; stale pre-issuance edits are rejected',async()=>{
 const body=baseForm({link_price:80000,link_start_at:new Date(Date.now()-60000).toISOString(),link_end_at:new Date(Date.now()+3600000).toISOString()});const {pid,context}=await createForm(body),detail=api('admin/products/[id]'),link=api('admin/products/[id]/secret-link');
 const initial=await (await detail.GET(req(),context)).json();await query("UPDATE products_shop SET updated_at=NOW()+INTERVAL '1 second',stock=9 WHERE id=$1",[pid]);
 assert.equal((await link.POST(req('/x','POST',{expected_updated_at:initial.updated_at}),context)).status,409);
 const fresh=await (await detail.GET(req(),context)).json();const issued=await (await link.POST(req('/x','POST',{expected_updated_at:fresh.updated_at}),context)).json();
 const revoked=await link.DELETE(req('/x','DELETE',{expected_updated_at:issued.updated_at}),context);assert.equal(revoked.status,200);const v=await revoked.json();
 assert.equal((await detail.PATCH(req('/x','PATCH',{...body,stock:9,expected_updated_at:v.updated_at}),context)).status,200);
});

test('H7 zero-refund hotel cancellation records a known zero and restores room once',async()=>{
 await product();await order();site='blendpick';await query("UPDATE orders SET site='blendpick',order_type='hotel',stay_check_in='2000-01-01',stay_check_out='2000-01-02'");await query("UPDATE order_items SET option_label='룸A · 1박'");await query("INSERT INTO hotel_room_inventory VALUES('2000-01-01','룸A',2)");
 const cancel=load('lib/hotel-cancel.ts',mocks).cancelHotelReservation;assert.equal((await cancel(id(10),{reasonPrefix:'고객 취소'})).ok,true);assert.equal((await cancel(id(10),{reasonPrefix:'고객 취소'})).alreadyCancelled,true);
 assert.equal((await query('SELECT amount FROM order_refund_amounts')).rows[0].amount,0);assert.equal((await query('SELECT booked FROM hotel_room_inventory')).rows[0].booked,1);assert.equal((await profit())[0].review_reasons.includes('환불 금액 미확인'),false);
});

test('H8 hotel state-storage failure retries without a second refund or inventory decrement',async()=>{
 await product();await order();site='blendpick';await query("UPDATE orders SET site='blendpick',order_type='hotel',stay_check_in='2030-01-01',stay_check_out='2030-01-02'");await query("UPDATE order_items SET option_label='룸A · 1박'");await query("INSERT INTO hotel_room_inventory VALUES('2030-01-01','룸A',2)");
 let calls=0;global.fetch=async()=>{calls++;return Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});};let fail=true;hook=async(sql,p,run)=>{if(fail&&sql.includes('UPDATE hotel_room_inventory')){fail=false;throw Error('room storage failed');}return run(sql,p);};
 const cancel=load('lib/hotel-cancel.ts',mocks).cancelHotelReservation;assert.equal((await cancel(id(10),{reasonPrefix:'관리자',fullRefund:true})).ok,false);hook=null;assert.equal((await cancel(id(10),{reasonPrefix:'관리자',fullRefund:true})).ok,true);
 assert.equal(calls,1);assert.equal((await query('SELECT booked FROM hotel_room_inventory')).rows[0].booked,1);assert.equal((await query('SELECT COUNT(*)::int n FROM order_refund_amounts')).rows[0].n,1);
});

test('H9 inconsistent provider totals do not finalize or write guessed refund amounts',async()=>{
 await product();await order();global.fetch=async()=>Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:10000,status:'PARTIAL_CANCELED'});
 assert.equal((await load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'취소',{site})).ok,false);
 assert.equal((await query('SELECT status FROM orders')).rows[0].status,'paid');assert.equal((await query('SELECT COUNT(*)::int n FROM order_refund_amounts')).rows[0].n,0);
 assert.equal((await inf())[0].breakdown,null);
});

test('H10 uncertain refund older than the provider key retention window is never resent',async()=>{
 await product();await order();global.fetch=async()=>{throw Error('timeout');};const cancel=load('lib/order-cancel.ts',mocks).cancelShopOrder;await cancel(id(10),'취소',{site});
 await query("UPDATE refund_operations SET first_sent_at=NOW()-INTERVAL '16 days'");let calls=0;global.fetch=async()=>{calls++;throw Error('must not call');};
 assert.equal((await cancel(id(10),'취소',{site})).ok,false);assert.equal(calls,0);
});

test('H11 additive migration rerun preserves completed refund history and version triggers',async()=>{
 await product();await order();global.fetch=async()=>Response.json({paymentKey:'mock-10',totalAmount:100000,balanceAmount:0,status:'CANCELED'});assert.equal((await load('lib/order-cancel.ts',mocks).cancelShopOrder(id(10),'취소',{site})).ok,true);
 await db.exec(fs.readFileSync('scripts/admin-integrity.sql','utf8'));assert.equal((await query('SELECT status FROM refund_operations')).rows[0].status,'completed');assert.equal((await query('SELECT amount FROM order_refund_amounts')).rows[0].amount,100000);
 const old=Number((await query('SELECT version FROM finance_revisions WHERE site=$1',[site])).rows[0].version);await query('UPDATE order_items SET unit_price=90000');assert.ok(Number((await query('SELECT version FROM finance_revisions WHERE site=$1',[site])).rows[0].version)>old);
});

test('H12 product create and save responses support automatic link issuance with the saved version',async()=>{
 const body=baseForm({link_price:80000,link_start_at:new Date(Date.now()-60000).toISOString(),link_end_at:new Date(Date.now()+3600000).toISOString()});
 const created=await api('admin/products').POST(req('/x','POST',body));assert.equal(created.status,201);const made=await created.json();const context={params:Promise.resolve({id:made.id})},link=api('admin/products/[id]/secret-link');
 const issued=await link.POST(req('/x','POST',{expected_updated_at:made.updated_at}),context);assert.equal(issued.status,200);const issuedData=await issued.json();
 const saved=await api('admin/products/[id]').PATCH(req('/x','PATCH',{...body,name:'수정 상품',expected_updated_at:issuedData.updated_at}),context);assert.equal(saved.status,200);const data=await saved.json();
 const again=await link.POST(req('/x','POST',{expected_updated_at:data.updated_at}),context);assert.equal(again.status,200);assert.equal((await again.json()).code,issuedData.code);
});
