const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const {enqueue,discoverOrders,discoverInterests,processQueue}=require('../lib/customer-notifications.cjs');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=async(sql,args=[])=>{if(sql.startsWith('-- Additive')){await db.exec(sql);return {rows:[],rowCount:0};} const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
const pool={query,connect:async()=>({query,release(){}})};
let site,user,phone,admin;
const mocks={
 '@/lib/db-shop':pool,'@/lib/db':pool,
 'next/headers':{cookies:async()=>({get:name=>name==='shop_token'&&user?{value:user}:name==='admin_token'&&admin?{value:'admin'}:name==='phone_verified'&&phone?{value:phone}:undefined})},
 '@/lib/auth':{verifyToken:async token=>({id:token}),verifyAdminToken:async()=>admin?{id:'operator'}:null},
 '@/lib/phone-verify':{verifiedPhoneOf:async()=>phone},
 '@/lib/site-server':{currentSite:async()=>({key:site})},'@/lib/admin-site':{currentAdminSite:async()=>({key:site})},
};
const route=name=>load(`app/api/${name}/route.ts`,mocks);
const req=(path,body,method='POST')=>new Request(`https://shop.blendpunch.com/api/${path}`,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
async function post(name,body,method='POST'){return route(name)[method](req(name,body,method));}
async function product(n,{site='blendpick',stock=0,visible=true,start=null,status='active'}={}){
 await query('INSERT INTO products_shop(id,name,category,status,stock,is_visible,sale_start_at,price,shipping_type,shipping_cost) VALUES($1,$2,$3,$4,$5,$6,$7,10000,\'free\',0)',[id(n),'상품 '+n,site==='sanjipick'?'산지픽':'식품',status,stock,visible,start]);
}
async function order(n,{site='blendpick',owner=id(1),status='paid',paid=new Date(Date.now()+1000).toISOString()}={}){
 await query(`INSERT INTO orders(id,user_id,site,status,order_number,order_type,buyer_phone,total_amount,payment_key,paid_at) VALUES($1,$2,$3,$4,$5,'shop','01000000000',10000,'test-real-fixture',$6)`,[id(n),owner,site,status,'ORDER-'+n,paid]);
}
before(async()=>{
 await require('./support/integrity-schema.cjs')(db,id);
 await db.exec(`CREATE TABLE shop_users(id uuid PRIMARY KEY,is_active boolean); CREATE TABLE reviews(id uuid PRIMARY KEY,order_id uuid,product_id uuid,is_hidden boolean);
 CREATE TABLE cart(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,site text,product_id uuid,option_id uuid,quantity int);
 ALTER TABLE products_shop ADD COLUMN expected_ship_date date, ADD COLUMN IF NOT EXISTS archived_at timestamptz;`);
 await require('../scripts/prepare-customer-convenience.cjs').prepare(pool);
});
beforeEach(async()=>{
 site='blendpick';user=id(1);phone=null;admin=true;process.env.JWT_SECRET='isolated-test-secret';
 await db.exec('TRUNCATE customer_notifications,customer_interests,customer_questions,customer_addresses,customer_reorder_requests,review_replies,order_shipping_promises,product_customer_info,cart,reviews,order_items,orders,products_shop,shop_users CASCADE');
 await query('INSERT INTO shop_users VALUES($1,true),($2,true)',[id(1),id(2)]);
});
after(()=>db.close());

test('repeatable migration preserves state and subscriptions',async()=>{
 await product(10);await post('customer/interests',{product_id:id(10),kind:'restock',consent:true});
 const before=(await query('SELECT started_at FROM commerce_feature_state')).rows[0];await require('../scripts/prepare-customer-convenience.cjs').prepare(pool);
 assert.equal((await query('SELECT * FROM customer_interests')).rows.length,1);assert.deepEqual((await query('SELECT started_at FROM commerce_feature_state')).rows[0],before);
});
test('interests enforce session, active account, site, public visibility, consent and phone verification',async()=>{
 await product(10);await product(11,{site:'sanjipick'});await product(12,{visible:false});
 const body={product_id:id(10),kind:'restock',consent:true};user=null;assert.equal((await post('customer/interests',body)).status,401);user=id(1);
 await query('UPDATE shop_users SET is_active=false WHERE id=$1',[user]);assert.equal((await post('customer/interests',body)).status,401);await query('UPDATE shop_users SET is_active=true');
 assert.equal((await post('customer/interests',{...body,product_id:id(11)})).status,404);
 assert.equal((await post('customer/interests',{...body,product_id:id(12)})).status,404);
 assert.equal((await post('customer/interests',{...body,consent:false})).status,400);
 assert.equal((await post('customer/interests',{...body,phone_notice:true})).status,400);
 const cross=req('customer/interests',body);cross.headers.set('Origin','https://untrusted.example');assert.equal((await route('customer/interests').POST(cross)).status,403);
});
test('stock alert waits for selected option and emits only once; cancellation prevents sending',async()=>{
 await product(10,{stock:10});await query("INSERT INTO product_options(id,product_id,value,stock,is_active) VALUES($1,$2,'옵션',0,true)",[id(20),id(10)]);
 const body={product_id:id(10),option_id:id(20),kind:'restock',consent:true};
 assert.equal((await post('customer/interests',body)).status,200);assert.equal((await post('customer/interests',body)).status,200);
 assert.equal((await query('SELECT * FROM customer_interests')).rows.length,1);
 await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,0);
 await query('UPDATE product_options SET stock=2');await discoverInterests(pool);await discoverInterests(pool);
 let rows=(await query('SELECT * FROM customer_notifications')).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'site_only');
 const interest=(await query('SELECT id FROM customer_interests')).rows[0].id;
 await query("UPDATE customer_notifications SET status='pending',phone='01000000000'");
 assert.equal((await post('customer/interests',{id:interest},'DELETE')).status,200);
 let sends=0;await processQueue(pool,{sendNotice:async()=>{sends++;return {status:'accepted'};},receipt:async()=>({status:'delivered'})});assert.equal(sends,0);
});
test('opening waits for sale start; hidden, expired and cross-site interests do not notify',async()=>{
 await product(10,{stock:4,start:new Date(Date.now()+3600000).toISOString()});
 assert.equal((await post('customer/interests',{product_id:id(10),kind:'opening',consent:true})).status,200);
 await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,0);
 await query("UPDATE products_shop SET sale_start_at=now()-INTERVAL '1 minute',is_visible=false");await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,0);
 await query("UPDATE products_shop SET is_visible=true,category='산지픽'");await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,0);
 await query("UPDATE products_shop SET category='식품'");await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,1);
});
test('only a confirmed option of the selected product can be subscribed to',async()=>{
 await product(10);await product(11);await query("INSERT INTO product_options(id,product_id,stock,is_active) VALUES($1,$2,0,true)",[id(20),id(11)]);
 assert.equal((await post('customer/interests',{product_id:id(10),option_id:id(20),kind:'restock',consent:true})).status,400);
});
test('owner scoping covers notices, interests, addresses and private inquiries',async()=>{
 await product(10);await post('customer/interests',{product_id:id(10),kind:'wish'});
 const interest=(await query('SELECT id FROM customer_interests')).rows[0].id;
 await enqueue(pool,{site,key:'private',kind:'answer',userId:user,title:'private',body:'private',href:'/support'});
 await post('customer/addresses',{label:'집',recipient:'구매자',phone:'01000000000',zipcode:'12345',address:'테스트 주소',detail:'1'});
 await post('customer/questions',{request_key:id(90),category:'기타',message:'private question'});
 user=id(2);
 for(const path of ['interests','notifications','addresses','questions'])assert.equal((await (await route('customer/'+path).GET(req('customer/'+path,null,'GET'))).json()).items.length,0);
 assert.equal((await post('customer/interests',{id:interest},'DELETE')).status,404);
 user=id(1);site='sanjipick';assert.equal((await (await route('customer/questions').GET(req('customer/questions',null,'GET'))).json()).items.length,0);
});
test('Q&A needs explicit customer consent and operator publication; order inquiries stay private',async()=>{
 await product(10);await order(30);
 const body={request_key:id(90),category:'상품 문의',product_id:id(10),message:'보관 방법?',public_requested:true};
 await post('customer/questions',body);await post('customer/questions',body);assert.equal((await query('SELECT * FROM customer_questions')).rows.length,1);
 const q=(await query('SELECT id FROM customer_questions')).rows[0].id;
 const publicList=async()=> (await (await route('customer/questions').GET(req('customer/questions?product='+id(10),null,'GET'))).json()).items;
 assert.equal((await publicList()).length,0);await post('admin/customer-care',{action:'reply',id:q,reply:'냉장 보관',publish:true});assert.equal((await publicList()).length,1);
 await post('customer/questions',{...body,request_key:id(91),order_id:id(30)});const privateId=(await query('SELECT id FROM customer_questions WHERE order_id IS NOT NULL')).rows[0].id;
 await post('admin/customer-care',{action:'reply',id:privateId,reply:'주문 답변',publish:true});assert.equal((await publicList()).length,1);
 user=id(2);assert.equal((await post('customer/questions',{...body,request_key:id(92),order_id:id(30)})).status,404);
});
test('guest support uses verified purchaser phone and is not open to other customers',async()=>{
 await order(30,{owner:null});user=null;phone='01000000000';
 const body={order_id:id(30),request_key:id(90),category:'주문·배송',message:'배송 문의'};
 assert.equal((await post('customer/questions',body)).status,200);phone='01099999999';assert.equal((await post('customer/questions',{...body,request_key:id(91)})).status,404);
 assert.equal((await (await route('customer/questions').GET(req('customer/questions',null,'GET'))).json()).items.length,0);
});
test('shipping date changes are scoped, idempotent and queued after persistence',async()=>{
 await order(30);const body={action:'shipping-date',id:id(30),date:'2099-10-01',reason:'산지 수확 일정 변경'};
 assert.equal((await post('admin/customer-care',body)).status,200);await post('admin/customer-care',body);
 assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,1);
 await post('admin/customer-care',{...body,date:'2099-10-02'});assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,2);
 site='sanjipick';assert.equal((await post('admin/customer-care',body)).status,409);site='blendpick';admin=false;assert.equal((await post('admin/customer-care',body)).status,401);
});
test('new paid and completed refund events are distinct from historical or unconfirmed events',async()=>{
 await product(10,{stock:4});await order(30);await order(31,{paid:'2020-01-01'});await order(32,{status:'pending'});
 await query('INSERT INTO order_items(order_id,product_id,quantity) VALUES($1,$2,1)',[id(30),id(10)]);
 await discoverOrders(pool);await discoverOrders(pool);const rows=(await query('SELECT * FROM customer_notifications')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].event_key,'paid:'+id(30));assert.equal(rows[0].href,'/orders/lookup');
});
test('uncertain sending is never blindly retried and receipt distinguishes acceptance from delivery',async()=>{
 await enqueue(pool,{site,key:'test',kind:'refund',phone:'01000000000',title:'환불',body:'내용',href:'/orders/lookup'});
 let sends=0;const transport={sendNotice:async()=>{sends++;throw Error('lost response');},receipt:async()=>({status:'delivered'})};
 await processQueue(pool,transport);await processQueue(pool,transport);assert.equal(sends,1);assert.equal((await query('SELECT status FROM customer_notifications')).rows[0].status,'review');
 await enqueue(pool,{site,key:'test2',kind:'refund',phone:'01000000000',title:'환불',body:'내용',href:'/orders/lookup'});
 transport.sendNotice=async()=>({status:'accepted',providerId:'M123'});await processQueue(pool,transport);
 assert.equal((await query("SELECT status FROM customer_notifications WHERE event_key='test2'")).rows[0].status,'accepted');
 await processQueue(pool,transport);assert.equal((await query("SELECT status FROM customer_notifications WHERE event_key='test2'")).rows[0].status,'delivered');
});
test('address overwrite is bounded and is never an update of another user record',async()=>{
 const body={label:'집',recipient:'고객',phone:'01000000000',zipcode:'12345',address:'주소',detail:''};
 assert.equal((await post('customer/addresses',body)).status,200);await post('customer/addresses',{...body,detail:'변경'});
 assert.equal((await query('SELECT * FROM customer_addresses')).rows.length,1);
 for(let i=0;i<9;i++)await post('customer/addresses',{...body,label:'배송지'+i});assert.equal((await post('customer/addresses',{...body,label:'초과'})).status,400);
 assert.equal((await post('customer/addresses',{...body,zipcode:'invalid'})).status,400);
});
test('review replies cannot cross storefronts',async()=>{
 await product(10);await order(30);await query('INSERT INTO reviews(id,order_id,product_id) VALUES($1,$2,$3)',[id(40),id(30),id(10)]);
 assert.equal((await post('admin/review-replies',{id:id(40),reply:'감사합니다'},'PUT')).status,200);
 site='sanjipick';assert.equal((await post('admin/review-replies',{id:id(40),reply:'잘못된 사이트'},'PUT')).status,404);
});
test('reorder checks current price, requires confirmation and deduplicates a lost-response retry',async()=>{
 await product(10,{stock:20});await order(30);await query('INSERT INTO order_items(order_id,product_id,quantity,unit_price) VALUES($1,$2,2,5000)',[id(30),id(10)]);
 const api=route('customer/reorder');
 const preview=await api.GET(req('customer/reorder?order='+id(30),null,'GET'));assert.equal(preview.status,200);let data=await preview.json();assert.equal(data.items[0].price,10000);
 const body={order_id:id(30),request_key:id(90),quote:data.quote};
 await query('UPDATE products_shop SET price=12000');assert.equal((await post('customer/reorder',body)).status,409);assert.equal((await query('SELECT * FROM cart')).rows.length,0);
 data=await (await api.GET(req('customer/reorder?order='+id(30),null,'GET'))).json();body.quote=data.quote;
 assert.equal((await post('customer/reorder',body)).status,200);assert.equal((await post('customer/reorder',body)).status,200);assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,2);
 user=id(2);assert.equal((await post('customer/reorder',{...body,request_key:id(91)})).status,404);
});
test('reorder rejects sold-out/hidden stock and never silently drops an additional item',async()=>{
 await product(10,{stock:0});await order(30);await query('INSERT INTO order_items(order_id,product_id,quantity) VALUES($1,$2,1)',[id(30),id(10)]);
 const api=route('customer/reorder'),request=()=>req('customer/reorder?order='+id(30),null,'GET');assert.equal((await api.GET(request())).status,400);
 await query('UPDATE products_shop SET stock=10,is_visible=false');assert.equal((await api.GET(request())).status,400);
 await query('UPDATE products_shop SET is_visible=true');await query('INSERT INTO order_items(order_id,quantity) VALUES($1,1)',[id(30)]);assert.equal((await api.GET(request())).status,409);
});
test('older shipping-date notices are suppressed before sending the latest promise',async()=>{
 await order(30);await post('admin/customer-care',{action:'shipping-date',id:id(30),date:'2099-10-01',reason:'변경'});await post('admin/customer-care',{action:'shipping-date',id:id(30),date:'2099-10-02',reason:'확정'});
 const sent=[];await processQueue(pool,{sendNotice:async n=>{sent.push(n);return{status:'accepted',providerId:'M123'};},receipt:async()=>({status:'accepted'})});
 assert.equal(sent.length,1);assert.equal(sent[0].variables['#{출고예정일}'],'2099-10-02');
});


test('archived and relocated products are rejected before external stock notification',async()=>{
 await product(10);await post('customer/interests',{product_id:id(10),kind:'restock',consent:true});
 await query("UPDATE products_shop SET stock=2,archived_at=now()");
 assert.equal((await post('customer/interests',{product_id:id(10),kind:'wish'})).status,404);
 await discoverInterests(pool);assert.equal((await query('SELECT * FROM customer_notifications')).rows.length,0);
 await query('UPDATE products_shop SET archived_at=NULL');await discoverInterests(pool);
 await query("UPDATE customer_notifications SET phone='01000000000',status='pending'");
 await query("UPDATE products_shop SET category='산지픽'");
 let sends=0;await processQueue(pool,{sendNotice:async()=>{sends++;return {status:'accepted'};},receipt:async()=>({status:'delivered'})});
 assert.equal(sends,0);assert.equal((await query('SELECT status FROM customer_notifications')).rows[0].status,'cancelled');
});
test('withdrawal removes saved details but keeps order deduplication and private complaint records',async()=>{
 await product(10);await order(30);await discoverOrders(pool);
 await post('customer/interests',{product_id:id(10),kind:'wish'});
 await post('customer/addresses',{label:'집',recipient:'구매자',phone:'01000000000',zipcode:'12345',address:'테스트 주소',detail:'1'});
 await post('customer/questions',{request_key:id(90),category:'주문·배송',order_id:id(30),message:'품질 문의'});
 assert.equal((await route('auth/withdraw').POST()).status,200);
 assert.equal((await query('SELECT * FROM customer_addresses')).rows.length,0);
 assert.equal((await query('SELECT * FROM customer_interests')).rows.length,0);
 assert.equal((await query('SELECT * FROM shop_users WHERE id=$1',[user])).rows.length,0);
 const q=(await query('SELECT * FROM customer_questions')).rows[0];assert.equal(q.user_id,null);assert.equal(q.is_public,false);assert.equal(q.message,'품질 문의');
 await discoverOrders(pool);
 const notices=(await query('SELECT * FROM customer_notifications')).rows;assert.equal(notices.length,1);assert.equal(notices[0].status,'cancelled');assert.equal(notices[0].phone,null);
});


test('expired external send windows preserve the customer inbox without sending',async()=>{
 await order(30);await discoverOrders(pool);await query("UPDATE customer_notifications SET created_at=now()-INTERVAL '25 hours'");
 let sends=0;await processQueue(pool,{sendNotice:async()=>{sends++;return {status:'accepted'};},receipt:async()=>({status:'delivered'})});
 const n=(await query('SELECT * FROM customer_notifications')).rows[0];assert.equal(sends,0);assert.equal(n.status,'site_only');assert.equal(n.phone,null);
 const response=await route('customer/notifications').GET();assert.equal((await response.json()).items.length,1);
});
