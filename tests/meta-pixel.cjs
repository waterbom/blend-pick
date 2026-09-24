const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {load} = require('./support/load.cjs');

const previousWindow = global.window;
afterEach(() => { if (previousWindow === undefined) delete global.window; else global.window = previousWindow; });
function setup(storage = new Map()) {
  const calls = [];
  global.window = {
    location: {hostname:'shop.blendpunch.com', pathname:'/products/example'},
    localStorage: {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    fbq: (...args)=>calls.push(args),
  };
  return {a:load('lib/analytics.ts'),calls,storage};
}

test('SSR does not send or throw', () => {
  delete global.window;
  const a=load('lib/analytics.ts');
  assert.equal(a.fbqTrack('PageView'),false);
  assert.equal(a.trackPurchase('shop','order',1000),false);
  a.flushMetaEvents();
});
test('events wait for script readiness and flush once in order', () => {
  const {a,calls}=setup();const send=window.fbq;delete window.fbq;
  a.fbqTrack('PageView');a.fbqTrack('ViewContent',{content_ids:['p']});
  assert.equal(calls.length,0);
  window.fbq=send;a.flushMetaEvents();a.flushMetaEvents();
  assert.deepEqual(calls.map(c=>c[2]),['PageView','ViewContent']);
  assert.equal(calls[0][0],'trackSingle');assert.equal(calls[0][1],a.META_PIXEL_ID);
});
test('queue remains bounded when pixel cannot load',()=>{
  const {a}=setup();delete window.fbq;
  for(let n=0;n<100;n++)assert.equal(a.fbqTrack('PageView'),true);
  assert.equal(a.fbqTrack('PageView'),false);
});
test('third-party script failures never interrupt commerce and may be retried',()=>{
  const {a,calls}=setup();const send=window.fbq;window.fbq=()=>{throw Error('blocked');};
  assert.doesNotThrow(()=>a.fbqTrack('AddToCart'));
  window.fbq=send;a.flushMetaEvents();assert.equal(calls.length,1);
});
test('admin, authentication and personal account pages are excluded',()=>{
  const {a,calls}=setup();
  for(const path of ['/admin/products','/sanji/admin','/auth/callback','/login','/mypage/orders','/account','/hotel/lookup']){
    assert.equal(a.isPixelRoute(path),false);window.location.pathname=path;assert.equal(a.fbqTrack('PageView'),false);
  }
  assert.equal(calls.length,0);
  for(const path of ['/','/p/123','/sanji/p/123','/cart/checkout','/checkout/cart-success'])assert.equal(a.isPixelRoute(path),true);
});
test('option price replaces base price; zero-price options remain zero',()=>{
  const {a,calls}=setup();
  a.trackCartAdded([{product_id:'p',option_id:'o',quantity:2}],{price:10000},[{id:'o',extra_price:3000}]);
  assert.equal(calls[0][3].value,6000);assert.equal(calls[0][3].num_items,2);
  a.trackCartAdded([{product_id:'p',option_id:'free',quantity:1}],{price:10000},[{id:'free',extra_price:0}]);
  assert.equal(calls[1][3].value,0);
  a.trackCartAdded([],{price:10000},[]);assert.equal(calls.length,2);
});
test('purchase retries and reloads use persistent dedupe and stable eventID',()=>{
  const {a,calls,storage}=setup();
  assert.equal(a.trackPurchase('shop','opaque-id',5000),true);
  assert.equal(a.trackPurchase('shop','opaque-id',5000),false);
  assert.equal(calls.length,1);assert.equal(calls[0][4].eventID,'shop.blendpunch.com:shop:opaque-id');
  const next=setup(storage);assert.equal(next.a.trackPurchase('shop','opaque-id',5000),false);
  assert.equal(next.a.trackPurchase('shop','another-id',5000),true);
});
test('bad amounts cannot fabricate a Purchase from callback query parameters',()=>{
  const {a,calls}=setup();
  for(const amount of [undefined,null,'5000',NaN,Infinity,-1])assert.equal(a.trackPurchase('shop','o',amount),false);
  assert.equal(calls.length,0);
  assert.equal(a.trackPurchase('shop','free-order',0),true);assert.equal(calls[0][3].value,0);
});
test('storage restrictions and malformed item metadata do not break successful payment',()=>{
  const {a,calls}=setup();
  window.localStorage={getItem:()=>{throw Error('disabled');},setItem:()=>{throw Error('disabled');}};
  assert.equal(a.trackPurchase('hotel','paid',30000,null),true);
  assert.equal(a.trackPurchase('hotel','paid',30000),false);assert.equal(calls.length,1);
});
test('event payload only contains catalog identifiers, quantity, price, total and currency',()=>{
  const {a,calls}=setup();
  a.trackPurchase('shop','o',9000,[{id:'p',quantity:2,price:3000,name:'private',phone:'private',address:'private'}]);
  assert.deepEqual(calls[0][3],{content_type:'product',content_ids:['p'],contents:[{id:'p',quantity:2,item_price:3000}],num_items:2,value:9000,currency:'KRW'});
  assert.ok(!JSON.stringify(calls).includes('private'));
});
test('confirmed response exposes only explicit catalog fields for pixel item metadata',async()=>{
  const {purchaseResult}=load('lib/payment-attempt.ts',{'@/lib/db-shop':{}});
  const result=await purchaseResult({amount:9000,snapshot:{orderNumber:'o',buyerName:'private',items:[{productId:'p',productRef:'p',unitPrice:3000,quantity:2,name:'Product'}]}},'CARD');
  assert.deepEqual(result.pixelItems,[{id:'p',quantity:2,price:3000}]);assert.equal(result.totalAmount,9000);
});
test('all payment completion flows use the shared deduplicated purchase helper',()=>{
  for(const path of ['app/checkout/shop-success/page.tsx','app/checkout/cart-success/page.tsx','app/checkout/success/page.tsx','app/checkout/hotel-success/page.tsx','app/pay/extra/success/page.tsx','components/dangung/Result.tsx']){
    const source=fs.readFileSync(path,'utf8');assert.match(source,/trackPurchase\(/,path);assert.doesNotMatch(source,/fbqTrack\("Purchase"/,path);
  }
  assert.match(fs.readFileSync('components/dangung/Result.tsx','utf8'),/recentPayment && data.status === 'paid'/);
});
test('view and checkout hook sends once per key under effect replay',()=>{
  const sent=[],ref={current:''};
  const {useMetaEvent}=load('lib/use-meta-event.ts',{'react':{useRef:()=>ref,useEffect:fn=>{fn();fn();}},'@/lib/analytics':{fbqTrack:(...args)=>{sent.push(args);return true;}}});
  useMetaEvent('InitiateCheckout','cart',{},false);assert.equal(sent.length,0);
  useMetaEvent('InitiateCheckout','cart',{},true);useMetaEvent('InitiateCheckout','cart',{value:123},true);assert.equal(sent.length,1);
  useMetaEvent('ViewContent','next-product',{},true);assert.equal(sent.length,2);
});
test('initial and SPA PageViews have one owner, and readiness only flushes',()=>{
  const {a,calls}=setup();const ref={current:null};let pathname='/products/example';
  const View=load('components/MetaPixel.tsx',{
    react:{useRef:()=>ref,useEffect:fn=>{fn();fn();}},
    'next/navigation':{usePathname:()=>pathname},
    'next/script':()=>null,'@/lib/analytics':a,
  }).default;
  const tree=View();View();
  const script=tree.props.children[0];script.props.onReady();
  assert.equal(calls.length,1);assert.equal(calls[0][2],'PageView');
  assert.doesNotMatch(script.props.children,/fbq\('track', 'PageView'\)/);
  pathname='/cart';window.location.pathname=pathname;View();assert.equal(calls.length,2);
  pathname='/admin';window.location.pathname=pathname;assert.equal(View(),null);assert.equal(calls.length,2);
  pathname='/cart';window.location.pathname=pathname;View();assert.equal(calls.length,3);
});
