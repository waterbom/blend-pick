const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
const {selectionAction,shipmentStatusMatches,matchesOrderSearch}=load('lib/admin-list-workspace.ts');
const {productListView}=load('lib/admin-product-list.ts');
const order=(id,status='paid',extra={})=>({id,order_number:'TEST-'+id,site:'blendpick',status,order_type:'shop',paid_at:'2026-10-20T00:00:00Z',payment_verified:true,
 buyer_name:'예시 구매자',buyer_phone:'01000001234',recipient_name:'예시 수령인',recipient_phone:'01000005678',addr_zipcode:'00000',addr_address:'테스트 주소',
 total_amount:35000,shipping_fee:0,created_at:'2026-10-19T23:45:30Z',items:[{id:'item-'+id,product_id:'p',product_name:'테스트 상품',quantity:1,option_label:'대용량',supplier_name:'테스트 공급사'}],...extra});
test('mixed stages, stale selections and refund holds cannot expose a bulk dispatch action',()=>{
 const rows=[order('a'),order('b','preparing'),order('c','shipped'),order('d','paid',{pending_refunds:true}),order('e','cancel_requested')];
 for(const ids of [['a','b'],['b','c'],['a','missing'],['d']])assert.equal(selectionAction(rows,new Set(ids)),'mixed');
 for(const [id,action]of [['a','dispatch'],['b','tracking'],['c','deliver'],['e','cancel']])assert.equal(selectionAction(rows,new Set([id])),action);
 assert.equal(selectionAction(rows,new Set()),'none');
});
test('shipment active/history filters exclude unconfirmed orders and customer requests',()=>{
 const statuses=['paid','confirmed','preparing','shipped','delivered','cancel_requested','return_requested','cancelled','exchange_completed','return_completed'];
 assert.deepEqual(statuses.filter(s=>shipmentStatusMatches(s,'active')),['preparing','shipped']);
 assert.deepEqual(statuses.filter(s=>shipmentStatusMatches(s,'history')),['delivered','cancelled','exchange_completed','return_completed']);
});
test('one search covers supplier, option, exact tracking and normalized phone without matching short digits',()=>{
 const row=order('a','shipped',{tracking_number:'001234567890'});
 for(const q of ['공급사','대용량','010-0000-5678','001234567890',' TEST-A '])assert.equal(matchesOrderSearch(row,q),true);
 assert.equal(matchesOrderSearch(row,'99'),false);assert.equal(matchesOrderSearch(row,'없는상품'),false);
});
const common={
 'next/link':({children,prefetch,...props})=>React.createElement('a',props,children),
 'next/navigation':{useRouter:()=>({refresh(){}})},
 '@/components/SiteContext':{useSiteKey:()=> 'blendpick'},
 '@/components/admin/OrderQuickView':({order})=>React.createElement('a',null,order.order_number),
};
test('orders expose ready, review and cancellation rows immediately, with KST time and host scope',()=>{
 const View=load('components/admin/OrdersClient.tsx',common).default;
 const html=renderToStaticMarkup(React.createElement(View,{sharedOrders:[order('ready'),order('review','paid',{addr_address:''}),order('cancel','cancel_requested'),order('done','delivered'),order('foreign','paid',{site:'sanjipick'})]}));
 for(const value of ['TEST-ready','TEST-review','TEST-cancel','배송지 누락','08:45:30'])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/TEST-done|TEST-foreign/);
 assert.equal((html.match(/<table/g)||[]).length,1);
 assert.doesNotMatch(html,/<summary>테스트 상품/);
});
test('one shipment table combines preparing and shipped while completed history remains selectable',()=>{
 const View=load('components/admin/ShipmentsClient.tsx',common).default;
 const html=renderToStaticMarkup(React.createElement(View,{sharedOrders:[order('prep','preparing'),order('ship','shipped',{tracking_number:'001234567890',tracking_company:'04'}),order('done','delivered'),order('foreign','preparing',{site:'sanjipick'})]}));
 assert.match(html,/TEST-prep/);assert.match(html,/TEST-ship/);assert.match(html,/001234567890/);
 assert.doesNotMatch(html,/TEST-done|TEST-foreign/);assert.match(html,/처리 완료 전체/);
 assert.equal((html.match(/<table/g)||[]).length,1);
});
test('product stages use existing sale boundaries and stock warnings intersect with search',()=>{
 const now=Date.parse('2026-10-20T00:00:00Z');
 const products=[{id:'a',name:'사과',status:'active',stock:5},{id:'b',name:'배',status:'active',stock:0},{id:'c',name:'사과 예약',status:'active',stock:7,sale_start_at:'2026-11-01'},{id:'d',name:'종료 사과',status:'active',stock:4,sale_end_at:'2026-10-19'}];
 assert.deepEqual(productListView(products,{},now).products.map(p=>p.id),['a']);
 assert.deepEqual(productListView(products,{f:'all',q:'사과'},now).products.map(p=>p.id),['a','c','d']);
 assert.deepEqual(productListView(products,{f:'warn'},now).products.map(p=>p.id),['b']);
 assert.equal(productListView(products,{f:'active'},now).stage,'selling');
 assert.equal(productListView(products,{f:'all'},now).counts.closed,2);
});
test('product list authenticates before looking up host products or sales',async()=>{
 let read=false;
 const Page=load('app/admin/(protected)/products/page.tsx',{
  'next/headers':{cookies:async()=>({get:()=>undefined})},'next/navigation':{redirect:()=>{throw Error('login');}},
  '@/lib/auth':{verifyAdminToken:async()=>null},'@/lib/db-shop':{query:async()=>{read=true;throw Error('read');}},
  '@/lib/admin-site':{currentAdminSite:async()=>{read=true;}},'@/lib/product-sales':{},'@/components/admin/ProductsListView':()=>null,
 }).default;
 await assert.rejects(Page({searchParams:Promise.resolve({})}),/login/);assert.equal(read,false);
});

function mountReturns(t,respond,initialRequestId){
 const state=[],effects=[],requests=[];let cursor=0;
 const oldFetch=global.fetch;global.fetch=async(url,options)=>{requests.push({url,options});return respond(url,options);};t.after(()=>{global.fetch=oldFetch;});
 const hooks={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 const View=load('components/admin/ReturnsPanel.tsx',{...common,react:hooks}).default;
 const render=()=>{cursor=0;effects.length=0;return View({kind:'all',initialRequestId});};
 return{requests,render,async start(){render();for(const fn of [...effects])fn();for(let i=0;i<5;i++)await new Promise(setImmediate);}};
}
const request=(kind)=>({id:kind,order_id:'o',order_number:'TEST-'+kind,kind,status:'requested',items:[],reason:'테스트 사유',photos:[],buyer_name:'예시',created_kst:'10/20 10:00',events:[]});
test('combined returns keeps successful kind visible when the other fetch fails',async t=>{
 const f=mountReturns(t,url=>url.includes('kind=exchange')?Response.json([request('exchange')]):Response.json({error:'조회 실패',code:'DB_UNAVAILABLE'},{status:503}));
 await f.start();const html=renderToStaticMarkup(f.render());
 assert.match(html,/TEST-exchange/);assert.match(html,/DB_UNAVAILABLE/);assert.match(html,/교환 완료/);assert.doesNotMatch(html,/반품 완료 · 환불/);
 assert.equal(f.requests.length,2);
});
test('combined returns labels each row by its own kind and keeps request deep-link scope',async t=>{
 const f=mountReturns(t,url=>Response.json([request(url.includes('kind=exchange')?'exchange':'return')]),'request-uuid');
 await f.start();const html=renderToStaticMarkup(f.render());
 assert.match(html,/교환 완료/);assert.match(html,/반품 완료 · 환불/);
 assert.ok(f.requests.every(r=>r.url.endsWith('&id=request-uuid')));
});


const {settlementList}=load('lib/admin-settlement-list.ts');
const settlementRows=Array.from({length:251},(_,i)=>({id:'s'+i,order_id:'o'+i,order_number:'SET-'+i,buyer_name:i===200?'찾는 구매자':'고객',site:'blendpick',settled_at:'2026-10-19T15:30:00Z',gross_amount:10000,fee:300,net_amount:i===200?null:9700,unresolved:i===200,fee_estimated:false}));
test('settlement paging exposes records after 200 and intersects KST period, search and unresolved filter',()=>{
 const now=new Date('2026-10-20T00:00:00Z');
 const page=settlementList(settlementRows,{period:'today',page:'5'},now);
 assert.equal(page.pages,6); assert.equal(page.rows[0].id,'s200');assert.equal(page.selected.length,251);
 const filtered=settlementList(settlementRows,{period:'today',q:'찾는',check:'unresolved',page:'900'},now);
 assert.equal(filtered.page,1); assert.deepEqual(filtered.rows.map(r=>r.id),['s200']);
 assert.equal(settlementList(settlementRows,{period:'today'},new Date('2026-10-19T14:59:00Z')).rows.length,0);
});
test('settlement view preserves unknown totals and exposes direct order links with scoped paging',()=>{
 const View=load('components/admin/SettlementsListView.tsx',common).default;
 const html=renderToStaticMarkup(React.createElement(View,{all:settlementRows,filters:{period:'today',page:'5'},now:'2026-10-20T00:00:00Z'}));
 assert.match(html,/확인 필요/);assert.match(html,/SET-200/);assert.match(html,/href="\/admin\/orders\/o200"/);
 assert.match(html,/period=today&amp;page=6/);assert.doesNotMatch(html,/undefined|NaN/);
 const failed=renderToStaticMarkup(React.createElement(View,{all:null,filters:{},now:'2026-10-20T00:00:00Z'}));
 assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/내역이 없습니다|0원/);
});
test('settlement page authenticates before reading and passes only display fields to its view',async()=>{
 let authenticated=false,reads=0;
 const mocks={...common,'next/headers':{cookies:async()=>({get:()=>authenticated?{value:'fixture'}:undefined})},'next/navigation':{redirect:()=>{throw Error('login');}},'@/lib/auth':{verifyAdminToken:async()=>authenticated},'@/lib/admin-site':{currentAdminSite:async()=>{reads++;return {key:'sanjipick'};}},'@/lib/settlement-view':{settlementView:async(site)=>{reads++;assert.equal(site,'sanjipick');return [{...settlementRows[0],payment_key:'PRIVATE-PAYMENT',internal_note:'PRIVATE-NOTE'}];}},'@/components/admin/SettlementsListView':()=>null};
 const Page=load('app/admin/(protected)/settlements/page.tsx',mocks).default;
 await assert.rejects(Page({searchParams:Promise.resolve({})}),/login/);assert.equal(reads,0);
 authenticated=true; const result=await Page({searchParams:Promise.resolve({q:'SET'})});
 assert.equal(reads,2);assert.equal(result.props.all[0].site,'sanjipick');assert.doesNotMatch(JSON.stringify(result.props),/PRIVATE|payment_key|internal_note/);
});
