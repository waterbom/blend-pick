const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {load}=require('./support/load.cjs');
function setup(){
 const state=[],effects=[];let cursor=0,quoteItems;
 const hookReact={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},useEffect(fn){effects.push(fn);}};
 const Editor=()=>null,Verify=()=>null,Consent=()=>null;const storage=new Map(),router={replace(){},push(){}};
 const original={window:global.window,sessionStorage:global.sessionStorage,fetch:global.fetch};
 const item={id:'line',product_id:'product',option_id:'opt',quantity:1,name:'검증 상품',price:12000,extra_price:12000};
 storage.set('cartCheckoutData',JSON.stringify({fromCart:false,items:[item],totalAmount:12000,shippingCost:3000}));
 storage.set('checkout-form:v1',JSON.stringify({at:Date.now(),form:{customerName:'검증 구매자',customerPhone:'01000000000',shippingZipcode:'12345',shippingAddress:'검증 주소',phoneVerified:true,privacyAgreed:true}}));
 global.window={location:{origin:'https://test.invalid'}};
 global.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 global.fetch=async(url,opts)=>{assert.equal(url,'/api/cart/resolve');return Response.json({items:JSON.parse(opts.body).items.map(i=>({...i,price:15000,extra_price:15000,availableOptions:[{id:'opt',name:'구성',value:'6팩',price:15000,stock:10}]}))});};
 const View=load('components/CartCheckoutClient.tsx',{'react':hookReact,'next/navigation':{useRouter:()=>router},'@tosspayments/tosspayments-sdk':{loadTossPayments(){throw Error('Real payment blocked');}},'@/components/CheckoutItemEditor':Editor,'@/components/PhoneVerifyField':Verify,'@/components/PrivacyConsent':Consent,'@/components/AddressSearchButton':()=>null,'@/components/RollingWon':()=>null,'@/lib/use-shipping-quote':{useShippingQuote(items,zip,goods){quoteItems=items;return{ready:zip==='12345',quote:{goodsAmount:goods,totalAmount:goods+3000,shippingCost:3000,installationCost:0},error:'',refresh:async()=>{throw Error('No payment');}};}}}).default;
 const render=()=>{cursor=0;effects.length=0;return View({clientKey:'not-real',phoneVerifyRequired:true});};
 const walk=(node,pred)=>{if(!node||typeof node!=='object')return null;if(pred(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,pred);if(found)return found;}return null;};
 const text=n=>n==null?'':typeof n==='string'||typeof n==='number'?String(n):React.Children.toArray(n.props?.children).map(text).join('');
 const findEditor=t=>walk(t,n=>n.type===Editor);
 const pay=t=>walk(t,n=>n.type==='button'&&text(n).endsWith('결제하기'));
 return{render,effects,storage,walk,text,findEditor,pay,Verify,Consent,quoteItems:()=>quoteItems,async init(){render();effects[0]();await new Promise(setImmediate);await new Promise(setImmediate);},close(){Object.assign(global,original);}};
}
test('checkout restores input but resets phone verification and consent',async()=>{const f=setup();try{await f.init();const t=f.render();assert.equal(f.walk(t,n=>n.props?.name==='customerName').props.value,'검증 구매자');assert.equal(f.walk(t,n=>n.type===f.Verify).props.verified,false);assert.equal(f.walk(t,n=>n.type===f.Consent).props.checked,false);}finally{f.close();}});
test('pending option edits block payment until applied; successful edit persists canonical price and quantity',async()=>{const f=setup();try{await f.init();let t=f.render();assert.equal(f.pay(t).props.disabled,false);f.findEditor(t).props.onDirty(true);t=f.render();assert.equal(f.pay(t).props.disabled,true);await f.findEditor(t).props.onApply('opt',2);t=f.render();assert.equal(f.pay(t).props.disabled,false);const d=JSON.parse(f.storage.get('cartCheckoutData'));assert.equal(d.items[0].quantity,2);assert.equal(d.items[0].extra_price,15000);assert.equal(d.fromCart,false);assert.equal(f.quoteItems()[0].quantity,2);}finally{f.close();}});
test('unavailable option preserves the last valid order and blocks payment',async()=>{const f=setup();try{await f.init();global.fetch=async()=>Response.json({items:[{id:'line',unavailable:true}]});await f.findEditor(f.render()).props.onApply('bad',99);const t=f.render();assert.equal(f.pay(t).props.disabled,true);assert.equal(JSON.parse(f.storage.get('cartCheckoutData')).items[0].quantity,1);assert.match(f.text(t),/판매 상태와 수량/);}finally{f.close();}});
test('changing phone invalidates verification and same-as-buyer stays synchronized',async()=>{const f=setup();try{await f.init();let t=f.render();f.walk(t,n=>n.type===f.Verify).props.onVerified();f.walk(f.render(),n=>n.props?.name==='sameAsBuyer').props.onChange({target:{name:'sameAsBuyer',type:'checkbox',checked:true}});f.walk(f.render(),n=>n.props?.name==='customerPhone').props.onChange({target:{name:'customerPhone',type:'text',value:'01011112222'}});t=f.render();assert.equal(f.walk(t,n=>n.type===f.Verify).props.verified,false);assert.equal(f.walk(t,n=>n.props?.name==='shippingPhone').props.value,'01011112222');}finally{f.close();}});
test('draft persistence excludes verification and consent state',async()=>{const f=setup();try{await f.init();f.render();f.effects[1]();const d=JSON.parse(f.storage.get('checkout-form:v1'));assert.equal(d.form.customerName,'검증 구매자');assert.equal(d.form.phoneVerified,undefined);assert.equal(d.form.privacyAgreed,undefined);}finally{f.close();}});
function addressFixture(fail=false){
 const values=[],effects=[];let cursor=0,options,embedded=false;
 const react={...React,useState(v){const i=cursor++;if(!(i in values))values[i]=v;return[values[i],n=>{values[i]=typeof n==='function'?n(values[i]):n;}];},useRef(){const i=cursor++;if(!(i in values))values[i]={current:{replaceChildren(){},focus(){}}};return values[i];},useEffect(fn){effects.push(fn);}};
 const original={window:global.window,document:global.document};const selected=[];
 global.window=fail?{}:{kakao:{Postcode:class{constructor(o){options=o;}embed(){embedded=true;}}}};
 global.document={createElement:()=>({remove(){}}),head:{appendChild(script){script.onerror();}}};
 const View=load('components/AddressSearchButton.tsx',{'react':react}).default;
 const render=()=>{cursor=0;effects.length=0;return View({onSelect:(...v)=>selected.push(v)});};
 const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];
 const text=n=>n==null?'':typeof n==='string'?n:React.Children.toArray(n.props?.children).map(text).join('');
 return{render,nodes,text,selected,options:()=>options,embedded:()=>embedded,async open(){nodes(render()).find(n=>n.type==='button').props.onClick();render();effects[0]();await new Promise(setImmediate);},close(){Object.assign(global,original);}};
}
test('address lookup embeds in the page and returns the full postcode including leading zero',async()=>{const f=addressFixture();try{await f.open();assert.equal(f.embedded(),true);f.options().oncomplete({zonecode:'01234',userSelectedType:'R',roadAddress:'검증 도로명 주소',jibunAddress:'지번'});assert.deepEqual(f.selected,[['01234','검증 도로명 주소']]);assert.equal(f.nodes(f.render()).some(n=>n.type==='section'),false);}finally{f.close();}});
test('address provider load failure displays a retry action instead of silently doing nothing',async()=>{const f=addressFixture(true);try{await f.open();const t=f.render();assert.ok(f.nodes(t).some(n=>n.props?.role==='alert'));assert.match(f.text(t),/다시 시도/);}finally{f.close();}});
