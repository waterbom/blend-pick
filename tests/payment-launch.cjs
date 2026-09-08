const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');
const { paymentModes } = require('../scripts/check-payment-config.cjs');
const { SANJI_DEMO_PRODUCTS, SANJI_DEMO_CARDS } = load('lib/sanji-demo.ts');
const navigation = { useRouter: () => ({ push() { throw Error('Navigation during render'); } }), notFound() { throw Error('NOT_FOUND'); } };
const Sales = load('components/sanji/SanjiSalesPage.tsx', { 'next/navigation': navigation }).default;
const props = d => ({ product: d.product, images: [], options: d.options, reviews: {list:[],total:0,average:0}, stats: {sold:0,buyers:0,rebuyers:0}, others:[], influencerId:null,linkCode:null,kakaoUrl:'/',linkBase:'' });
for (const d of SANJI_DEMO_PRODUCTS) test(`placeholder ${d.product.id} cannot open purchase or gift`, () => {
 assert.equal(d.product.stock,0); assert.equal(d.product.status,'soldout'); assert.equal(d.sold,0);
 assert.ok(d.options.every(o=>o.stock===0&&!o.is_active));
 const html=renderToStaticMarkup(React.createElement(Sales,{...props(d),demo:true}));
 assert.match(html,/재고가 마감되었습니다/);
 assert.match(html,/<button class="sp-buy" disabled="">재고 마감<\/button>/);
 assert.match(html,/<button class="sp-gift" disabled="">/);
 assert.doesNotMatch(html,/누적 [0-9,]+개 판매|오픈 준비 중|스마트스토어 리뷰/);
});
test('catalog displays six closed placeholders',()=>{
 const Catalog=load('components/sanji/SanjiCatalog.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Catalog,{products:SANJI_DEMO_CARDS,linkBase:''}));
 assert.equal((html.match(/class="so">재고 마감/g)||[]).length,6);
});
test('new registered active product offers purchase, closed product does not',()=>{
 const p=props(SANJI_DEMO_PRODUCTS[0]);p.product={...p.product,id:'00000000-0000-4000-8000-000000000001',status:'active',stock:10};p.options=[];
 assert.match(renderToStaticMarkup(React.createElement(Sales,p)),/<button class="sp-buy">구매하기<\/button>/);
 p.product.stock=0;
 assert.match(renderToStaticMarkup(React.createElement(Sales,p)),/<button class="sp-buy" disabled="">재고 마감<\/button>/);
});
const id='00000000-0000-4000-8000-000000000001', oid='00000000-0000-4000-8000-000000000002';
const active={id,name:'등록 상품',category:'산지픽',status:'active',stock:10,price:10000,is_visible:true,shipping_type:'free',shipping_cost:0,archived_at:null};
const payment={site:'sanjipick',productId:id,quantity:1,unitPrice:10000,totalAmount:10000,shippingCost:0,amount:10000};
function fixture(product=active,options=[]) {
 const db={query:async(sql,args)=>({rows:sql.includes('FROM products_shop')?[product]:sql.includes('FROM product_options')?options:[]})};
 const mocks={'@/lib/db-shop':db,'@/lib/db':db,'next/navigation':navigation,'@/components/Header':()=>null,'@/components/ShopCheckoutClient':p=>React.createElement('button',{'data-checkout':true},p.quantity),'@/lib/site-server':{currentSite:async()=>({key:'sanjipick'})},'next/headers':{cookies:async()=>({get:()=>null})},'@/lib/auth':{verifyToken:async()=>null},'@/lib/sms':{phoneVerifyOn:()=>false}};
 // The detail query selects one option, while the shared verifier requests all current options.
 db.query=async(sql)=>({rows:sql.includes('FROM products_shop')?[product]:sql.includes('FROM product_options')?options:[]});
 return {amounts:load('lib/order-amount.ts',mocks),page:load('app/products/[id]/checkout/page.tsx',mocks).default};
}
test('unregistered identifiers fail before any database or gateway call',async()=>{
 const amounts=load('lib/order-amount.ts',{'@/lib/db-shop':{query:()=>{throw Error('DB must not run');}}});
 assert.equal((await amounts.verifySingleAmount({...payment,productId:'demo'})).detail,'unregistered product');
 assert.equal((await amounts.verifyCartAmount({items:[{product_id:'demo-2',quantity:1}],amount:10000,totalAmount:10000,shippingCost:0})).ok,false);
});
for(const [label,patch,ok] of [['new active',{},true],['sold out',{stock:0},false],['draft',{status:'draft'},false],['archived',{archived_at:new Date().toISOString()},false],['ended',{sale_end_at:new Date(Date.now()-1000).toISOString()},false],['upcoming',{sale_start_at:new Date(Date.now()+3600000).toISOString()},false],['foreign site',{category:'뷰티'},false]]) test(`checkout page and approval agree: ${label}`,async()=>{
 const {amounts,page}=fixture({...active,...patch});
 assert.equal((await amounts.verifySingleAmount(payment)).ok,ok);
 const html=renderToStaticMarkup(await page({params:Promise.resolve({id}),searchParams:Promise.resolve({})}));
 assert.equal(html.includes('data-checkout="true"'),ok);
});
test('unlimited registered option can enter checkout',async()=>{
 const {page,amounts}=fixture(active,[{id:oid,product_id:id,name:'규격',value:'3kg',extra_price:10000,stock:-1,is_active:true}]);
 assert.equal((await amounts.verifySingleAmount({...payment,optionId:oid})).ok,true);
 const html=renderToStaticMarkup(await page({params:Promise.resolve({id}),searchParams:Promise.resolve({optionId:oid})}));
 assert.match(html,/data-checkout="true"/);
});
test('live/test/missing configuration classified without revealing credentials',()=>{
 assert.deepEqual(paymentModes({TOSS_CLIENT_KEY:'live_ck_dummy',TOSS_SECRET_KEY:'live_sk_dummy'}),{client:'live',server:'live'});
 assert.deepEqual(paymentModes({TOSS_CLIENT_KEY:'test_ck_dummy',TOSS_SECRET_KEY:'live_sk_dummy'}),{client:'test',server:'live'});
 assert.deepEqual(paymentModes({}),{client:'missing',server:'missing'});
});
