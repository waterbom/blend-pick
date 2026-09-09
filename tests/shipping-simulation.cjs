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
test('S1 CSV -> import -> repeat -> tracking -> settlement is single and site isolated',async()=>{
 await product();await order();await query("UPDATE orders SET buyer_phone='01000000000'");let sent=0;
 const route=load('app/api/admin/shipments/import/route.ts',{...mocks,'@/lib/sms':{smsConfigured:()=>true,sendSMS:async()=>{sent++;return {ok:true};}}});
 const rows=load('lib/shipping-flow.ts').parseTrackingCSV('주문번호,운송장번호\nORDER10,0012345678').map(r=>({...r,carrier:'04'}));
 for(let i=0;i<2;i++){const r=await route.POST(req('/x','POST',{rows}));assert.equal(r.status,200);assert.equal((await r.json()).succeeded,1);}
 assert.equal(sent,1);assert.equal((await query('SELECT tracking_number FROM orders')).rows[0].tracking_number,'0012345678');
 site='blendpick';assert.equal((await (await route.POST(req('/x','POST',{rows}))).json()).succeeded,0);site='sanjipick';
 const old=process.env.SWEETTRACKER_API_KEY;process.env.SWEETTRACKER_API_KEY='TEST';global.fetch=async()=>Response.json({lastStateDetail:{level:6,text:'완료'}});
 try{assert.equal((await api('admin/shipments/track').POST()).status,200);assert.equal((await query('SELECT status FROM orders')).rows[0].status,'delivered');await api('admin/shipments/track').POST();assert.equal((await query('SELECT * FROM settlements')).rows.length,1);}finally{if(old===undefined)delete process.env.SWEETTRACKER_API_KEY;else process.env.SWEETTRACKER_API_KEY=old;}
});
test('S2 cancelled and malformed rows are blocked while valid row proceeds',async()=>{
 await product();await order(10,100000,'cancelled');await order(11);await order(12);
 const body=await(await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'123'},{order_number:'ORDER11',carrier:'04',tracking_number:'6.99E+11'},{order_number:'ORDER12',carrier:'04',tracking_number:'00123'}]}))).json();assert.equal(body.succeeded,1);assert.equal(body.failed.length,2);
});
test('S3 hyphen-only invoice must be rejected before shipping',async()=>{
 await product();await order();await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'---'}]}));assert.equal((await query('SELECT status FROM orders')).rows[0].status,'paid');
});
test('S4 completed shipment must not silently replace original tracking',async()=>{
 await product();await order(10,100000,'delivered');await query("UPDATE orders SET tracking_number='111111',tracking_company='04'");await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'222222'}]}));assert.equal((await query('SELECT tracking_number FROM orders')).rows[0].tracking_number,'111111');
});
test('S5 missing carrier must not mark shipment ready for automatic tracking',async()=>{
 await product();await order();await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',tracking_number:'001234'}]}));assert.equal((await query('SELECT status FROM orders')).rows[0].status,'paid');
});

test('S6 real XLSX -> stored invoice -> order API -> tracking link preserves exact strings',async()=>{
 const XLSX=require('xlsx');
 const numbers=['001234567890','12345678901234567890','001-234-567'];
 const ws=XLSX.utils.aoa_to_sheet([['주문번호','운송장번호','택배사'],...numbers.map((n,i)=>['ORDER'+(10+i),n,'04'])]);
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'송장');
 const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 const rows=await load('lib/tracking-xlsx.ts').parseTrackingXlsx(bytes);
 assert.deepEqual(rows.map(r=>r.tracking_number),numbers);
 await product();for(let i=0;i<numbers.length;i++)await order(10+i);
 const result=await(await api('admin/shipments/import').POST(req('/x','POST',{rows:rows.map(r=>({...r,carrier:r.carrier_raw}))}))).json();assert.equal(result.succeeded,3);
 const stored=(await query('SELECT tracking_number FROM orders ORDER BY order_number')).rows.map(r=>r.tracking_number);assert.deepEqual(stored,numbers);
 const {trackingUrl}=load('lib/carriers.ts');for(const n of stored)assert(trackingUrl('04',n).includes(n));
 const response=await api('admin/orders').GET(req());assert.equal(response.status,200);
 const data=await response.json();const orders=Array.isArray(data)?data:data.orders;assert.deepEqual(orders.map(o=>o.tracking_number).sort(),[...numbers].sort());
});
test('S7 numeric XLSX keeps 12 digits and explicit zero padding, rejects precision loss',async()=>{
 const XLSX=require('xlsx');const {parseTrackingXlsx}=load('lib/tracking-xlsx.ts');
 async function parse(value,format){const ws=XLSX.utils.aoa_to_sheet([['주문번호','운송장번호'],['ORDER10',value]]);if(format)ws.B2.z=format;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'송장');return parseTrackingXlsx(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));}
 assert.equal((await parse(699528123456))[0].tracking_number,'699528123456');
 assert.equal((await parse(123456,'0000000000'))[0].tracking_number,'0000123456');
 await assert.rejects(parse(12345678901234568),/정밀도/);await assert.rejects(parse(123.45),/정밀도/);
});
test('S8 completed identical invoice reupload succeeds without replacement',async()=>{
 await product();await order(10,100000,'delivered');await query("UPDATE orders SET tracking_number='001234',tracking_company='04'");const result=await(await api('admin/shipments/import').POST(req('/x','POST',{rows:[{order_number:'ORDER10',carrier:'04',tracking_number:'001234'}]}))).json();assert.equal(result.succeeded,1);assert.equal((await query('SELECT status FROM orders')).rows[0].status,'delivered');
});

test('S9 shipment table renders exact invoice and carrier label',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const target='components/admin/ShipmentsClient.tsx';
 const {OrderTable}=load(target,{'@/components/SiteContext':{useSiteKey:()=> 'sanjipick'}},new Map(),file=>fs.readFileSync(file,'utf8')+(file===target?'\nexport { OrderTable };':''));
 const invoice='00123456789012345678';
 const html=renderToStaticMarkup(React.createElement(OrderTable,{orders:[{id:'preview',site:'sanjipick',order_number:'TEST10',created_at:'2026-09-09',items:[],total_amount:10000,tracking_company:'04',tracking_number:invoice}],loading:false,selected:new Set(),onToggle:()=>{},onToggleAll:()=>{},showTracking:true,emptyText:'없음'}));
 assert(html.includes('>'+invoice+'</div>'));assert(html.includes('CJ대한통운'));
});
