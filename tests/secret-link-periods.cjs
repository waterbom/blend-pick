const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const {NextRequest}=require('next/server');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=async(sql,params=[])=>{const r=await db.query(sql,params.map(v=>v instanceof Date?v.toISOString():v));return {...r,rowCount:r.affectedRows??r.rows.length};};
const pool={query,connect:async()=>({query,release(){}})};
let site='sanjipick',authenticated=true;
const mocks={'@/lib/db-shop':pool,'@/lib/db':{query:async()=>({rows:[]})},'next/headers':{cookies:async()=>({get:()=>authenticated?{value:'admin'}:undefined}),headers:async()=>new Headers({host:site==='sanjipick'?'sanjipick.blendpunch.com':'shop.blendpunch.com'})},'@/lib/auth':{verifyAdminToken:async()=>authenticated?{}:null,verifyToken:async()=>null},'@/lib/sms':{phoneVerifyOn:()=>false},'@/lib/phone-verify':{isPhoneVerified:async()=>false},'@/lib/inf-ref':{infRefFromCookie:()=>null}};
const rules=load('lib/secret-link.ts',mocks);
const amounts=load('lib/order-amount.ts',mocks);
const settings=load('lib/admin-secret-link.ts',mocks);
const api=load('app/api/admin/products/[id]/secret-link/route.ts',mocks);
const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+3600000).toISOString();
const code='a'.repeat(32);
async function product(n=1,option=false){
 await db.query(`INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,link_price,link_code,link_start_at,link_end_at) VALUES($1,'테스트 사과','산지픽',10000,100,'active',true,'free',0,8000,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET link_code=$2,link_start_at=$3,link_end_at=$4`,[id(n),code,start,end]);
 if(option)await db.query(`INSERT INTO product_options(id,product_id,value,extra_price,link_price,stock,is_active) VALUES($1,$2,'5kg',15000,12300,100,true) ON CONFLICT(id) DO NOTHING`,[id(n+100),id(n)]);
}
const single=(patch={})=>amounts.verifySingleAmount({site:'sanjipick',productId:id(1),quantity:1,unitPrice:8000,shippingCost:0,totalAmount:8000,amount:8000,linkCode:code,...patch});
before(async()=>{
 await db.exec(`CREATE TABLE products_shop(id uuid PRIMARY KEY,name text,category text,price int,stock int,status text,is_visible boolean,shipping_type text,shipping_cost int,free_shipping_threshold int,per_unit_shipping_cost int,link_price int,link_code text,updated_at timestamptz,sale_start_at timestamptz,sale_end_at timestamptz);
 CREATE TABLE product_options(id uuid PRIMARY KEY,product_id uuid REFERENCES products_shop(id) ON DELETE CASCADE,value text,extra_price int,stock int,is_active boolean);
 CREATE TABLE product_addons(product_id uuid,name text,extra_price int,is_active boolean);
 CREATE TABLE orders(id uuid PRIMARY KEY,site text,order_type text,paid_at timestamptz,status text,total_amount int,payment_key text,link_code text);
 CREATE TABLE order_items(id uuid PRIMARY KEY,order_id uuid,product_id uuid,quantity int);
 `);
 await db.exec(fs.readFileSync('scripts/secret-link-periods.sql','utf8'));
 for (const [table,cols] of Object.entries({
   products_shop:{product_code:'text',brand:'text',description:'text',original_price:'int',instant_discount_price:'int',sale_type:'text',presale_enabled:'boolean',presale_start_at:'timestamptz',presale_end_at:'timestamptz',tax_type:'text',shipping_carrier:'text',shipping_attr:'text',island_shipping_cost:'int',installation_cost:'int',release_address:'text',return_address:'text',return_cost_oneway:'int',return_cost_roundtrip:'int',exchange_cost_oneway:'int',exchange_cost_roundtrip:'int',as_notes:'text',manufacturer:'text',origin_country:'text',product_condition:'text',manufacture_date:'date',main_image:'text',addon_multi:'boolean',supply_price:'int',influencer_rate:'numeric',influencer_id:'uuid'},
   product_options:{name:'text',sort_order:'int',supply_price:'int'},
   product_addons:{id:'uuid default gen_random_uuid()',sort_order:'int'},
   orders:{order_number:'text',user_id:'uuid',buyer_name:'text',buyer_phone:'text',buyer_email:'text',recipient_name:'text',recipient_phone:'text',addr_zipcode:'text',addr_address:'text',addr_detail:'text',addr_memo:'text',shipping_fee:'int',payment_method:'text',influencer_id:'uuid',influencer_name:'text',commission_rate:'numeric',cancelled_at:'timestamptz',updated_at:'timestamptz'},
   order_items:{option_id:'uuid',product_name:'text',option_label:'text',unit_price:'int',supply_price:'int'},
 }))for(const [col,type] of Object.entries(cols)) await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
 for(const table of ['products_shop','product_options','orders','order_items']) await db.exec(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
 await db.exec('CREATE TABLE product_images(product_id uuid,url text,sort_order int);');
});
after(()=>db.close());
test('start inclusive / end exclusive, missing dates and malformed code fail closed',()=>{
 const p={price:10,link_code:code,link_start_at:start,link_end_at:end};
 assert.equal(rules.linkApplies(p,code,Date.parse(start)),true);
 assert.equal(rules.linkApplies(p,code,Date.parse(start)-1),false);
 assert.equal(rules.linkApplies(p,code,Date.parse(end)),false);
 assert.equal(rules.linkApplies({...p,link_end_at:null},code),false);
 for(const c of ['',code+' ',code.toUpperCase(),[],null])assert.equal(rules.linkApplies(p,c),false);
});
test('option prices are explicit, including zero; unconfigured options excluded',()=>{
 assert.equal(rules.secretUnitPrice({price:10000,link_price:8000},{extra_price:15000,link_price:12300},true),12300);
 assert.equal(rules.secretUnitPrice({price:10000,link_price:8000},{extra_price:15000,link_price:null},true),null);
 assert.equal(rules.secretUnitPrice({price:10000,link_price:8000},{extra_price:15000,link_price:0},true),0);
 assert.equal(rules.secretUnitPrice({price:10000}, {extra_price:15000},false),15000);
 for(const v of [-1,1.5,NaN,'abc',true,2147483648])assert.equal(rules.validLinkPrice(v),false);
});
test('migration can run again without deleting orders',async()=>{
 await db.exec(fs.readFileSync('scripts/secret-link-periods.sql','utf8'));
 await product();assert.equal((await single()).ok,true);
});
test('wrong, empty and expired tokens rejected even at full public price',async()=>{
 for(const linkCode of ['wrongcode','',[],code+' '])assert.equal((await single({linkCode,unitPrice:10000,totalAmount:10000,amount:10000})).error,rules.INVALID_LINK);
 await db.query('UPDATE products_shop SET link_end_at=NOW()-INTERVAL \'1 second\' WHERE id=$1',[id(1)]);
 assert.equal((await single({unitPrice:10000,totalAmount:10000,amount:10000})).error,rules.INVALID_LINK);
 await product();
});
test('public purchase stays public; foreign site and hidden public requests rejected',async()=>{
 const r=await single({linkCode:null,unitPrice:10000,totalAmount:10000,amount:10000});assert.equal(r.ok,true);assert.equal(r.linkCode,null);
 assert.equal((await single({site:'blendpick'})).ok,false);
 await db.query('UPDATE products_shop SET is_visible=false WHERE id=$1',[id(1)]);
 assert.equal((await single({linkCode:null})).error,rules.INVALID_LINK);
 await db.query('UPDATE products_shop SET is_visible=true WHERE id=$1',[id(1)]);
});
test('server option snapshot, ownership, missing price, missing option and quantity checks',async()=>{
 await product(2,true);
 const p={productId:id(2),optionId:id(102),unitPrice:12300,totalAmount:12300,amount:12300};
 const r=await single(p);assert.equal(r.ok,true);assert.deepEqual(r.units,[12300]);assert.deepEqual(r.optionLabels,['5kg']);
 assert.equal((await single({...p,optionId:null})).ok,false);
 assert.equal((await single({...p,productId:id(1)})).ok,false);
 assert.equal((await single({...p,quantity:101})).ok,false);
 await db.query('UPDATE product_options SET link_price=NULL WHERE id=$1',[id(102)]);
 assert.equal((await single(p)).error,rules.INVALID_LINK);
 await db.query('UPDATE product_options SET link_price=12300 WHERE id=$1',[id(102)]);
});
test('mixed channels cannot obscure order attribution; duplicate option stock is summed',async()=>{
 const check=items=>amounts.verifyCartAmount({site:'sanjipick',items,totalAmount:18000,shippingCost:0,amount:18000});
 assert.equal((await check([{product_id:id(1),quantity:1,link_code:code},{product_id:id(1),quantity:1}])).detail,'mixed sales channels');
 assert.equal((await check([{product_id:id(2),option_id:id(102),quantity:60,link_code:code},{product_id:id(2),option_id:id(102),quantity:60,link_code:code}])).ok,false);
});
test('same period issues exactly one code; revoke and overlapping periods cannot resurrect it',async()=>{
 const ctx={params:Promise.resolve({id:id(1)})};
 const req=()=>new Request('https://sanjipick.blendpunch.com/api/admin/products/x/secret-link',{method:'POST'});
 const first=await api.POST(req(),ctx);assert.equal(first.status,200);const c=(await first.json()).code;
 const again=await api.POST(req(),ctx);assert.equal((await again.json()).code,c);
 assert.equal((await db.query('SELECT * FROM product_secret_links WHERE product_id=$1',[id(1)])).rows.length,1);
 await api.DELETE(req(),ctx);assert.equal((await api.POST(req(),ctx)).status,409);
 await settings.saveLinkSettings(await pool.connect(),id(1),{link_start_at:start,link_end_at:new Date(Date.parse(end)+3600000).toISOString()});
 assert.equal((await api.POST(req(),ctx)).status,409);
 const nextStart=new Date(Date.parse(end)+1).toISOString(),nextEnd=new Date(Date.parse(end)+7200000).toISOString();
 await settings.saveLinkSettings(await pool.connect(),id(1),{link_start_at:nextStart,link_end_at:nextEnd});
 const next=await api.POST(req(),ctx);assert.equal(next.status,200);assert.notEqual((await next.json()).code,c);
 await product();
});
test('unauthenticated or wrong-site issuance denied without mutation',async()=>{
 authenticated=false;assert.equal((await api.POST(new Request('https://a'),{params:Promise.resolve({id:id(1)})})).status,401);
 authenticated=true;site='blendpick';assert.equal((await api.POST(new Request('https://a'),{params:Promise.resolve({id:id(1)})})).status,404);site='sanjipick';
});
test('shop and cart approval handlers never contact payment API for invalid links',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('NO EXTERNAL CALLS');};
 try{
  for(const kind of ['shop','cart']){
   const post=load(`app/api/payment/${kind}-confirm/route.ts`,mocks).POST;
   const checkoutData=kind==='shop'?{productId:id(1),quantity:1,unitPrice:10000,linkCode:'wrongcode',shippingCost:0,totalAmount:10000}:{items:[{product_id:id(1),quantity:1,price:10000,link_code:'wrongcode'}],shippingCost:0,totalAmount:10000};
   const res=await post(new NextRequest('https://sanjipick.blendpunch.com/api/payment/'+kind+'-confirm',{method:'POST',headers:{'content-type':'application/json',host:'sanjipick.blendpunch.com'},body:JSON.stringify({paymentKey:'TEST',orderId:'TEST',amount:10000,checkoutData})}));
   assert.equal(res.status,400);assert.equal((await res.json()).error,rules.INVALID_LINK);
  }
  assert.equal(calls,0);
 }finally{global.fetch=original;}
});
test('admin create/edit round trip persists period and per-option price, preserves visibility and option id',async()=>{
 const create=load('app/api/admin/products/route.ts',mocks).POST;
 const detail=load('app/api/admin/products/[id]/route.ts',mocks);
 const body={name:'새 사과',price:10000,category:'산지픽',stock:100,status:'active',shipping_type:'free',is_visible:false,link_start_at:start,link_end_at:end,options:[{name:'3kg',price:10000,link_price:7300,stock:30,active:true}],extra_images:[],addons:[]};
 const req=(method,b)=>new Request('https://sanjipick.blendpunch.com/api/admin/products',{method,headers:{'content-type':'application/json'},body:JSON.stringify(b)});
 const made=await create(req('POST',body));assert.equal(made.status,201);const pid=(await made.json()).id;
 const ctx={params:Promise.resolve({id:pid})};
 let read=await (await detail.GET(new Request('https://a'),ctx)).json();assert.equal(read.options[0].link_price,7300);assert.equal(Date.parse(read.link_end_at),Date.parse(end));const oid=read.options[0].id;
 const changed={...body,options:[{...body.options[0],link_price:6900}]};delete changed.is_visible;
 assert.equal((await detail.PATCH(req('PATCH',changed),ctx)).status,200);
 read=await (await detail.GET(new Request('https://a'),ctx)).json();assert.equal(read.is_visible,false);assert.equal(read.options[0].link_price,6900);assert.equal(read.options[0].id,oid);
 assert.equal((await detail.PATCH(req('PATCH',{...changed,options:[{...body.options[0],link_price:-1}]}),ctx)).status,400);
});
test('approved shop and cart persist verified channel, period, option id/name and server unit prices',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({method:'카드'});
 try{
  for(const kind of ['shop','cart']){
   const post=load(`app/api/payment/${kind}-confirm/route.ts`,mocks).POST;
   const checkoutData=kind==='shop'?{productId:id(2),productName:'FORGED',optionLabel:'FORGED',optionId:id(102),quantity:1,unitPrice:12300,linkCode:code,shippingCost:0,totalAmount:12300}:{items:[{product_id:id(2),option_id:id(102),quantity:1,price:1,extra_price:2,name:'FORGED',link_code:code}],shippingCost:0,totalAmount:12300};
   const res=await post(new NextRequest('https://sanjipick.blendpunch.com/api/payment/'+kind+'-confirm',{method:'POST',headers:{'content-type':'application/json',host:'sanjipick.blendpunch.com'},body:JSON.stringify({paymentKey:'mock-'+kind,orderId:'TEST',amount:12300,checkoutData})}));
   assert.equal(res.status,200,JSON.stringify(await res.json()));
   const saved=(await db.query('SELECT o.sales_channel,o.link_end_at,i.unit_price,i.option_id,i.product_name,i.option_label FROM orders o JOIN order_items i ON i.order_id=o.id WHERE payment_key=$1',['mock-'+kind])).rows[0];
   assert.equal(saved.sales_channel,'non_display');assert.equal(saved.unit_price,12300);assert.equal(saved.option_id,id(102));assert.equal(saved.product_name,'테스트 사과');assert.equal(saved.option_label,'5kg');assert.equal(new Date(saved.link_end_at).getTime(),Date.parse(end));
  }
  await db.exec("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE payment_key LIKE 'mock-%'); DELETE FROM orders WHERE payment_key LIKE 'mock-%';");
 }finally{global.fetch=original;}
});
test('invalid product/link stops before image, review, related-product reads; invalid metadata reveals no name',async()=>{
 let reads=0;
 const limited={...mocks,'@/lib/db-shop':{query:async()=>{reads++; if(reads>1)throw Error('private data must not be read');return {rows:[{id:id(1),name:'PRIVATE NAME',price:9000,link_code:code,link_start_at:start,link_end_at:end,is_visible:true}]};}}};
 const data=load('lib/sanji-data.ts',limited);
 assert.equal(await data.loadSanjiSalesPage(id(1),undefined,'wrongcode'),null);assert.equal(reads,1);
 reads=0;
 const page=load('app/sanji/p/[id]/page.tsx',limited);
 const meta=await page.generateMetadata({params:Promise.resolve({id:id(1)}),searchParams:Promise.resolve({k:'wrongcode'})});
 assert.equal(meta.title,'잘못된 요청입니다');assert.equal(meta.robots.index,false);assert.equal(meta.openGraph,undefined);
});
test('expired client page removes prices and buy controls',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Page=load('components/sanji/SanjiSalesPage.tsx',{'next/navigation':{useRouter:()=>({push(){}})}}).default;
 const html=renderToStaticMarkup(React.createElement(Page,{product:{id:id(1),name:'PRIVATE NAME',price:87654,stock:10,status:'active',link_end_at:'2000-01-01',shipping_type:'free'},options:[],images:[],reviews:{list:[],total:0,average:0},stats:{buyers:0,sold:0,rebuyers:0},others:[],influencerId:null,linkCode:code,kakaoUrl:'',linkBase:''}));
 assert.match(html,/잘못된 요청입니다/);assert.doesNotMatch(html,/PRIVATE NAME|87,654|구매하기/);
});
test('refund failure writes nothing; successful cancellation records actual deduction once',async()=>{
 const cancel=load('lib/order-cancel.ts',mocks).cancelShopOrder;
 await db.query("INSERT INTO orders(id,site,order_type,paid_at,status,total_amount,shipping_fee,payment_key,link_code) VALUES($1,'sanjipick','shop',NOW(),'paid',10000,3000,'real-cancel',$2)",[id(90),code]);
 const original=global.fetch;let calls=0;
 try{
  global.fetch=async()=>{calls++;return Response.json({message:'mock failure'},{status:400});};
  assert.equal((await cancel(id(90),'test',{deductShipping:true})).ok,false);
  assert.equal((await db.query('SELECT * FROM order_refund_amounts WHERE order_id=$1',[id(90)])).rows.length,0);
  global.fetch=async()=>{calls++;return Response.json({});};
  assert.equal((await cancel(id(90),'test',{deductShipping:true})).ok,true);
  assert.equal((await cancel(id(90),'test',{deductShipping:true})).alreadyCancelled,true);
  const saved=(await db.query('SELECT amount FROM order_refund_amounts WHERE order_id=$1',[id(90)])).rows;
  assert.deepEqual(saved,[{amount:7000}]);assert.equal(calls,2);
 }finally{global.fetch=original;}
 await db.query('DELETE FROM order_refund_amounts WHERE order_id=$1',[id(90)]);await db.query('DELETE FROM orders WHERE id=$1',[id(90)]);
});
test('paid channel totals avoid item fanout; refunds survive expiry/deletion and unknown legacy refunds suppress net',async()=>{
 for(const [n,channel,status,total,key] of [[1,code,'paid',20000,'real1'],[2,null,'cancelled',10000,'real2'],[3,code,'paid',99999,'SIM_test'],[4,code,'return_completed',5000,'real4']]){
  await db.query('INSERT INTO orders(id,site,order_type,paid_at,status,total_amount,payment_key,link_code) VALUES($1,\'sanjipick\',\'shop\',NOW(),$2,$3,$4,$5)',[id(n),status,total,key,channel]);
 }
 await db.query('INSERT INTO order_items(id,order_id,product_id,quantity) VALUES($1,$2,$3,2),($4,$2,$3,3)',[id(10),id(1),id(1),id(11)]);
 await db.query('INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES(\'return:1\',$1,3000)',[id(1)]);
 await db.query('DELETE FROM products_shop WHERE id=$1',[id(1)]);
 const rows=await load('lib/link-sales.ts',mocks).getLinkSales('sanjipick',start,new Date(Date.now()+86400000).toISOString());
 const hidden=rows.find(x=>x.sales_channel==='non_display'),shown=rows.find(x=>x.sales_channel==='display');
 assert.equal(hidden.orders,2);assert.equal(Number(hidden.units),5);assert.equal(Number(hidden.gross),25000);assert.equal(Number(hidden.refunds),3000);assert.equal(hidden.unresolved,1);assert.equal(shown.unresolved,1);
 assert.equal((await load('lib/link-sales.ts',mocks).getLinkSales('blendpick',start,end)).length,0);
});
