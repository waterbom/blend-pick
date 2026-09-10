const {test,before,beforeEach,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');const {load}=require('./support/load.cjs');
const db=new PGlite();const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let site='blendpick',auth=true,user=id(100),mutex=Promise.resolve();
const query=async(sql,p=[])=>{const r=await db.query(sql,p);return {...r,rowCount:r.affectedRows??r.rows.length};};
const pool={query,connect:async()=>{const prior=mutex;let release;mutex=new Promise(r=>release=r);await prior;return {query,release};}};
const mocks={'@/lib/db-shop':pool,'@/lib/db':{query:()=>{throw Error('Production DB blocked');}},'@/lib/site-server':{currentSite:async()=>({key:site})},'next/headers':{cookies:async()=>({get:()=>auth?{value:'mock'}:undefined})},'@/lib/auth':{verifyToken:async()=>({id:user})}};
const merge=load('app/api/cart/merge/route.ts',mocks);const resolve=load('app/api/cart/resolve/route.ts',mocks);const {quoteCartAmount}=load('lib/order-amount.ts',mocks);
const item=(n=1,q=1)=>({id:id(n+20),product_id:id(n),option_id:id(n+10),quantity:q});const req=items=>new Request('https://shop.blendpunch.com/api/cart/merge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
before(async()=>{await require('./support/integrity-schema.cjs')(db,id);await db.exec('CREATE TABLE cart(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,product_id uuid,option_id uuid,quantity integer,site text,created_at timestamptz DEFAULT now());');await db.exec(fs.readFileSync('ops/sql/buyer-convenience.sql','utf8'));});
beforeEach(async()=>{site='blendpick';auth=true;user=id(100);await db.exec('TRUNCATE cart,guest_cart_imports,product_options,products_shop CASCADE');
 for(const [n,category] of [[1,'식품'],[2,'산지픽']]){await query("INSERT INTO products_shop(id,name,category,price,stock,status,is_visible,shipping_type,shipping_cost,free_shipping_threshold) VALUES($1,'검증 상품',$2,10000,10,'active',true,'conditional_free',3000,30000)",[id(n),category]);await query("INSERT INTO product_options(id,product_id,name,value,extra_price,stock,is_active) VALUES($1,$2,'중량','3kg',12000,10,true)",[id(n+10),id(n)]);}
});after(()=>db.close());
test('guest imports merge with member quantities and duplicate retries add once',async()=>{
 await query('INSERT INTO cart(user_id,product_id,option_id,quantity,site) VALUES($1,$2,$3,2,$4)',[user,id(1),id(11),site]);
 assert.equal((await merge.POST(req([item(1,2)]))).status,200);assert.equal((await merge.POST(req([item(1,2)]))).status,200);
 assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,4);
});
test('concurrent identical imports increment only once',async()=>{
 const results=await Promise.all([merge.POST(req([item()])),merge.POST(req([item()]))]);assert.ok(results.every(r=>r.status===200));assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,1);
});
test('same entry id with altered quantity is rejected without mutation',async()=>{
 await merge.POST(req([item()]));assert.equal((await merge.POST(req([item(1,3)]))).status,409);assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,1);
});
test('cross-site guest imports and anonymous merge cannot modify member cart',async()=>{
 assert.equal((await merge.POST(req([item(2)]))).status,409);auth=false;assert.equal((await merge.POST(req([item()]))).status,401);assert.equal((await query('SELECT count(*) n FROM cart')).rows[0].n,0);
});
test('batch stock failure rolls back successful earlier rows and import markers',async()=>{
 assert.equal((await merge.POST(req([item(1),{...item(1,99),id:id(90)}]))).status,409);assert.equal((await query('SELECT count(*) n FROM cart')).rows[0].n,0);assert.equal((await query('SELECT count(*) n FROM guest_cart_imports')).rows[0].n,0);
});
test('malformed ids, negative quantities and private links fail before writes',async()=>{
 for(const i of [{...item(),id:'bad'},{...item(),quantity:-1},{...item(),link_code:'secret12'}])assert.equal((await merge.POST(req([i]))).status,400);
});
test('catalog returns canonical price and no private/supply fields',async()=>{
 const body=await (await resolve.POST(req([{...item(),price:1}]))).json();assert.equal(body.items[0].extra_price,12000);assert.equal(body.items[0].availableOptions[0].price,12000);assert.equal(body.items[0].supply_price,undefined);assert.equal(body.items[0].availableOptions[0].link_price,undefined);
});
test('catalog blocks foreign site, hidden and sold out items',async()=>{
 let b=await(await resolve.POST(req([item(2)]))).json();assert.equal(b.items[0].unavailable,true);
 await query('UPDATE products_shop SET is_visible=false WHERE id=$1',[id(1)]);b=await(await resolve.POST(req([item()]))).json();assert.equal(b.items[0].unavailable,true);
});
test('checkout quantity changes cross free delivery threshold with server prices',async()=>{
 const input=q=>({site,items:[item(1,q)],shippingZipcode:'12345',totalAmount:0,shippingCost:0,amount:0});
 const one=await quoteCartAmount(input(1)),three=await quoteCartAmount(input(3));assert.equal(one.quote.totalAmount,15000);assert.equal(three.quote.totalAmount,36000);assert.equal(three.quote.shippingCost,0);
 const over=await quoteCartAmount(input(11));assert.equal(over.ok,false);
});
test('migration replay preserves import markers and cart',async()=>{await merge.POST(req([item()]));await db.exec(fs.readFileSync('ops/sql/buyer-convenience.sql','utf8'));await merge.POST(req([item()]));assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,1);});
const draft=load('lib/checkout-draft.ts');
test('draft restores only allowed fields; verification and consent cannot be restored',()=>{
 const empty={customerName:'',customerPhone:'',sameAsBuyer:false};const restored=draft.restoreCheckoutForm(JSON.stringify({at:100,form:{customerName:'구매자',customerPhone:'01000000000',sameAsBuyer:true,phoneVerified:true,privacyAgreed:true}}),empty,101);
 assert.deepEqual(restored,{customerName:'구매자',customerPhone:'01000000000',sameAsBuyer:true});
 for(const raw of ['bad',JSON.stringify({at:0,form:{}})])assert.equal(draft.restoreCheckoutForm(raw,empty,3600000),null);
});
test('dispatch dates use Korean date boundary and never promise a past date',()=>{
 const now=Date.parse('2026-09-10T16:00:00Z');assert.equal(draft.expectedShipLabel('2026-09-10',now),'출고 일정 확인 중');assert.match(draft.expectedShipLabel('2026-09-11',now),/2026.09.11 출고 예정/);assert.equal(draft.expectedShipLabel(null,now),'출고 일정 확인 중');
});
test('guest cart storage separates sites, expires, and removes only purchased entries',()=>{
 const storage=new Map(),original={localStorage:global.localStorage,window:global.window};
 global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};global.window={dispatchEvent(){}};
 try{
 const guest=load('lib/guest-cart.ts');guest.addGuestItems('blendpick',[{product_id:id(1),option_id:id(11),quantity:1,name:'검증'}]);guest.addGuestItems('sanjipick',[{product_id:id(2),option_id:id(12),quantity:2,name:'검증'}]);
 const first=guest.readGuestCart('blendpick')[0];guest.addGuestItems('blendpick',[{product_id:id(1),option_id:id(11),quantity:3,name:'새 항목'}]);guest.removeGuestItems('blendpick',[first.id]);assert.equal(guest.readGuestCart('blendpick')[0].quantity,3);assert.equal(guest.readGuestCart('sanjipick')[0].quantity,2);
 const key='guest-cart:v1:blendpick',saved=JSON.parse(storage.get(key));saved.at=Date.now()-8*86400000;storage.set(key,JSON.stringify(saved));assert.deepEqual(guest.readGuestCart('blendpick'),[]);
 }finally{Object.assign(global,original);}
});
test('temporary DB outage is reported as a load failure, not sold out',async()=>{
 const route=load('app/api/cart/resolve/route.ts',{'@/lib/site-server':{currentSite:async()=>({key:site})},'@/lib/db-shop':{query:async()=>{throw Error('DB offline');}}});
 assert.equal((await route.POST(req([item()]))).status,503);
});
test('lost commit acknowledgement remains uncertain and retry cannot duplicate quantities',async()=>{
 let fail=true;const uncertainPool={...pool,connect:async()=>{const c=await pool.connect();return {...c,query:async(sql,p)=>{const r=await c.query(sql,p);if(sql==='COMMIT'&&fail){fail=false;throw Error('ack lost');}return r;}};}};
 const api=load('app/api/cart/merge/route.ts',{...mocks,'@/lib/db-shop':uncertainPool});
 const first=await api.POST(req([item()]));assert.equal(first.status,503);assert.equal((await first.json()).rolledBack,false);
 assert.equal((await api.POST(req([item()]))).status,200);assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,1);
});
test('rollback reports only previously committed entries for safe local cleanup',async()=>{
 await merge.POST(req([item()]));const response=await merge.POST(req([item(),{...item(1,99),id:id(90)}]));const b=await response.json();assert.equal(response.status,409);assert.deepEqual(b.importedIds,[item().id]);assert.equal(b.rolledBack,true);assert.equal((await query('SELECT quantity FROM cart')).rows[0].quantity,1);
});
