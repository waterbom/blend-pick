const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
const {submitCartItems,optionText,internalReturnPath}=load('lib/buyer-flow.ts');
const payload=n=>({product_id:'product',option_id:String(n),quantity:1});
test('all writes must succeed before cart completion',async()=>{
 const r=await submitCartItems([payload(1),payload(2)],async()=>new Response('{}',{status:200}));
 assert.equal(r.completed,2);assert.equal(r.error,'');
});
for(const status of [400,403,409,500])test(`cart ${status} stops subsequent writes and reports failure`,async()=>{
 let calls=0;const r=await submitCartItems([payload(1),payload(2),payload(3)],async()=>new Response('{}',{status:++calls===1?200:status}));
 assert.equal(calls,2);assert.equal(r.completed,1);assert.ok(r.error);assert.equal(r.unauthorized,false);
});
test('expired login preserves knowledge of already completed items',async()=>{
 let calls=0;const r=await submitCartItems([payload(1),payload(2)],async()=>new Response('{}',{status:++calls===1?200:401}));
 assert.equal(r.completed,1);assert.equal(r.unauthorized,true);
});
test('uncertain network failure does not retry or claim success',async()=>{
 let calls=0;const r=await submitCartItems([payload(1),payload(2)],async()=>{calls++;throw Error('connection lost');});
 assert.equal(calls,1);assert.match(r.error,/중복/);assert.equal(r.completed,0);
});
test('duplicate and missing option names produce readable order summary',()=>{
 assert.equal(optionText(' 3kg ','3kg'),'3kg');assert.equal(optionText(null,'3kg'),'3kg');assert.equal(optionText('중량','3kg'),'중량: 3kg');
});
test('login return keeps product attribution but cannot leave this origin',()=>{
 const path='/products/123?inf=partner';assert.equal(internalReturnPath(path),path);
 for(const path of ['//evil.test','/\\evil.test','https://evil.test','/\nevil',null])assert.equal(internalReturnPath(path),'/');
});
test('refund delivery text reflects current product rule',()=>{
 const View=load('components/RefundPolicy.tsx').default;
 const html=renderToStaticMarkup(React.createElement(View,{shipping:'100,000원 이상 무료배송 (미만 3,500원)'}));
 assert.match(html,/미만 3,500원/);assert.doesNotMatch(html,/배송비: 무료/);
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(View)),/배송비: 무료/);
});
test('checkout metadata separates the two brands',async()=>{
 for(const key of ['blendpick','sanjipick']){
 const page=load('app/cart/checkout/page.tsx',{'@/components/Header':()=>null,'@/components/CartCheckoutClient':()=>null,'@/lib/auth':{},'@/lib/sms':{},'@/lib/site-server':{currentSite:async()=>({key})}});
 const metadata=await page.generateMetadata();assert.equal(metadata.title.absolute,`주문 / 결제 · ${key==='sanjipick'?'산지픽':'블랜드픽'}`);assert.equal(metadata.robots.index,false);
 }
});

// Run the actual component event handlers with deterministic hook state, without a browser or production API.
function fixture() {
 const state=[], effects=[];let cursor=0;
 const pushes=[],storage=new Map();
 const hookReact={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect(fn){effects.push(fn);}};
 const DsSelect=()=>null;
 const View=load('components/ProductDetail.tsx',{'react':hookReact,'@/components/SiteContext':{useSiteKey:()=> 'blendpick'},'@/lib/guest-cart':{addGuestItems:(site,items)=>storage.set('guest',JSON.stringify(items))},'next/navigation':{useRouter:()=>({push:p=>pushes.push(p)})},'@/components/DsSelect':DsSelect,'@/components/ReviewSection':()=>null,'@/components/RollingWon':()=>null});
 const props={product:{id:'p1',name:'상품',price:24900,original_price:50000,stock:10,status:'active',shipping_type:'paid',shipping_cost:3500,free_shipping_threshold:null},images:[],options:[{id:'o1',name:'구성',value:'6팩',extra_price:25900,stock:5,is_active:true}],addons:[],addonMulti:false,reviews:[]};
 const original={window:global.window,sessionStorage:global.sessionStorage,fetch:global.fetch};
 global.window={location:{pathname:'/products/p1',search:'?inf=partner'},addEventListener(){},removeEventListener(){},scrollY:0};
 global.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const render=()=>{cursor=0;effects.length=0;return View.default(props);};
 const walk=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const match=walk(child,predicate);if(match)return match;}return null;};
 const textOf=node=>node==null?'':typeof node==='string'||typeof node==='number'?String(node):React.Children.toArray(node.props?.children).map(textOf).join('');
 const button=(tree,label)=>walk(tree,n=>n.type==='button'&&textOf(n)===label);
 return {props,storage,pushes,effects,render,walk,textOf,button,select(){walk(render(),n=>n.type===DsSelect).props.onChange('o1');},close(){Object.assign(global,original);}};
}
test('actual detail: failure shows error and never says added',async()=>{
 const f=fixture();try{f.select();global.fetch=async()=>new Response('{}',{status:500});await f.button(f.render(),'장바구니').props.onClick();const tree=f.render();assert.match(f.textOf(f.walk(tree,n=>n.props?.role==='alert')),/저장에 실패/);assert.doesNotMatch(f.textOf(tree),/장바구니에 담김/);}finally{f.close();}
});
test('actual detail: selected quantity and option reach checkout',()=>{
 const f=fixture();try{assert.equal(f.button(f.render(),'바로 구매').props.disabled,true);f.select();f.button(f.render(),'+').props.onClick();f.button(f.render(),'바로 구매').props.onClick();const data=JSON.parse(f.storage.get('cartCheckoutData'));assert.equal(data.items[0].quantity,2);assert.equal(data.items[0].option_id,'o1');assert.equal(data.totalAmount,51800);assert.equal(f.pushes.at(-1),'/cart/checkout');}finally{f.close();}
});
test('actual detail: a guest can save selected items without a login redirect',async()=>{
 const f=fixture();try{f.select();global.fetch=async()=>new Response('{}',{status:401});await f.button(f.render(),'장바구니').props.onClick();assert.equal(f.pushes.length,0);assert.equal(JSON.parse(f.storage.get('guest'))[0].option_id,'o1');assert.match(f.textOf(f.render()),/장바구니에 담김/);}finally{f.close();}
});
test('actual detail: restore uses current stock and removes unavailable options',()=>{
 const f=fixture();try{f.storage.set('purchase-resume:p1',JSON.stringify({at:Date.now(),quantity:1,lines:[{optionId:'o1',qty:99},{optionId:'removed',qty:1}]}));f.render();f.effects[0]();const tree=f.render();assert.match(f.textOf(tree),/선택한 상품을 복원/);f.button(tree,'바로 구매').props.onClick();const data=JSON.parse(f.storage.get('cartCheckoutData'));assert.equal(data.items.length,1);assert.equal(data.items[0].quantity,5);}finally{f.close();}
});
test('actual detail: expired purchase draft does not override current selection',()=>{
 const f=fixture();try{f.storage.set('purchase-resume:p1',JSON.stringify({at:Date.now()-3600000,lines:[{optionId:'o1',qty:1}]}));f.render();f.effects[0]();assert.equal(f.button(f.render(),'바로 구매').props.disabled,true);}finally{f.close();}
});
test('Sanji detail exposes each purchasable grade with its own actual price',()=>{
 const navigation={useRouter:()=>({push(){}})};
 const {SANJI_DEMO_PRODUCTS}=load('lib/sanji-demo.ts');const source=SANJI_DEMO_PRODUCTS[0];
 const View=load('components/sanji/SanjiSalesPage.tsx',{'next/navigation':navigation}).default;
 const html=renderToStaticMarkup(React.createElement(View,{product:{...source.product,id:'live',status:'active',stock:10},images:[],options:[{id:'a',name:'실속형',value:'70% 내외',extra_price:38900,stock:10,is_active:true},{id:'b',name:'고급형',value:'80% 내외',extra_price:47900,stock:10,is_active:true},{id:'c',name:'숨긴 등급',value:'판매중지',extra_price:1,stock:10,is_active:false}],reviews:{list:[],total:0,average:0},stats:{sold:0,buyers:0,rebuyers:0},others:[],influencerId:null,linkCode:null,kakaoUrl:'#',linkBase:''}));
 assert.match(html,/옵션별 구성·등급과 가격/);assert.match(html,/실속형: 70% 내외/);assert.match(html,/38,900원/);assert.match(html,/고급형: 80% 내외/);assert.match(html,/47,900원/);
});
test('Sanji new arrivals links to the full catalog on both supported path bases',()=>{
 const {SANJI_DEMO_CARDS}=load('lib/sanji-demo.ts');
 const View=load('components/sanji/SanjiHome.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})}}).default;
 for(const linkBase of ['','/sanji']){
 const html=renderToStaticMarkup(React.createElement(View,{products:SANJI_DEMO_CARDS.map(p=>({...p,status:'active',stock:10})),reviews:[],linkBase,kakaoUrl:'#'}));
 assert.ok(html.includes(`href="${linkBase}/products">전체 보기`));
 }
});
