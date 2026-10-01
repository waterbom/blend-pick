const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {load}=require('./support/load.cjs');
const requestId='00000000-0000-4000-8000-000000000001';
const failure={error:'처리 상태가 변경되었습니다.',code:'STATE_CONFLICT',action:'현재 처리 결과를 확인해주세요.',requestId};
const text=n=>n==null?'':typeof n==='string'||typeof n==='number'?String(n):React.Children.toArray(n.props?.children).map(text).join('');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function mount(t,file,props={}){
 const state=[],effects=[],cleanups=[];let cursor=0;
 const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef(initial){const i=cursor++;return state[i]??={current:initial};},useEffect(fn){effects.push(fn);}};
 const before=global.fetch;t.after(()=>global.fetch=before);
 let read=()=>Response.json({items:[],info:{},questions:[],notifications:[],late:[],channels:{}}),write=()=>Response.json({ok:true});
 global.fetch=async(url,options={})=>(options.method&&options.method!=='GET'?write:read)(url,options);
 const View=load(file,{react,'@/components/SiteContext':{useSiteKey:()=> 'blendpick'}}).default;
 const render=()=>{cursor=0;effects.length=0;return View(props);};
 const find=predicate=>{const node=nodes(render()).find(predicate);assert.ok(node,'expected interactive control');return node;};
 return {render,find,feedback:()=>text(render()),respond:fn=>write=fn,respondGet:fn=>read=fn,
  async init(){render();for(const fn of [...effects]){const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);}await flush();},
  unmount(){for(const cleanup of cleanups)cleanup();},
  async click(label){await find(n=>n.type==='button'&&text(n).includes(label)).props.onClick();await flush();}
 };
}
function respond(mode){
 if(mode==='network')throw new TypeError('Failed to fetch');
 if(mode==='html')return new Response('<html>private upstream diagnostic</html>',{status:502,headers:{'X-Request-ID':requestId}});
 return Response.json(failure,{status:409});
}
function verifyFailure(f,mode){
 assert.match(f.feedback(),new RegExp(mode==='network'?'NETWORK_ERROR':mode==='html'?'RESPONSE_INVALID':'STATE_CONFLICT'));
 if(mode!=='network')assert.ok(f.feedback().includes(requestId));
 assert.doesNotMatch(f.feedback(),/private upstream diagnostic|Failed to fetch|저장했습니다|담았습니다/);
}
const scenarios=[
 {name:'review reply',file:'components/admin/ReviewReplyEditor.tsx',props:{id:'review',initial:'답변'},prepare:f=>f.click('판매자 답변'),run:f=>f.click('답변 저장'),success:/답변을 저장했습니다/},
 {name:'product care',file:'components/admin/ProductCareEditor.tsx',props:{productId:'product'},run:f=>f.click('상품·품질 안내 저장'),success:/상품·품질 안내를 저장했습니다/},
 {name:'reorder',file:'components/ReorderButton.tsx',props:{orderId:'order'},async prepare(f){f.respondGet(()=>Response.json({items:[{product_id:'product',name:'상품',price:12000,quantity:1}],quote:'quote'}));await f.click('다시 구매');},run:f=>f.click('현재 가격 확인'),success:/담았습니다/},
 {name:'address removal',file:'components/AddressBook.tsx',async prepare(f){f.respondGet(()=>Response.json({items:[{id:'address',label:'집',recipient:'테스트',zipcode:'12345',address:'주소',detail:''}]}));await f.click('배송지 주소록');},run:f=>f.click('삭제')},
 {name:'interest cancellation',file:'components/CustomerShopping.tsx',setup:f=>f.respondGet(url=>Response.json({items:String(url).includes('interests')?[{id:'interest',product_id:'product',name:'상품',kind:'wish',status:'active',available:true}]:[]})),retry:f=>f.click('다시 조회'),run:f=>f.click('관심 상품 삭제')},
 {name:'customer care reply',file:'components/admin/CustomerCareClient.tsx',setup:f=>f.respondGet(()=>Response.json({questions:[{id:'question',category:'문의',message:'질문',reply:'답변',public_requested:false}],notifications:[],late:[],channels:{}})),prepare:f=>f.click('답변 작성'),async run(f){await f.find(n=>n.type==='form'&&n.props.id==='reply-editor').props.onSubmit({preventDefault(){}});await flush();},success:/저장했습니다/},
];
for(const scenario of scenarios)for(const mode of ['server','html','network'])test(`${scenario.name} keeps ${mode} failure visible and allows successful retry`,async t=>{
 const f=mount(t,scenario.file,scenario.props);scenario.setup?.(f);await f.init();await scenario.prepare?.(f);
 f.respond(()=>respond(mode));await scenario.run(f);verifyFailure(f,mode);
 f.respond(()=>Response.json({ok:true}));await scenario.retry?.(f);await scenario.run(f);
 assert.doesNotMatch(f.feedback(),/STATE_CONFLICT|RESPONSE_INVALID|NETWORK_ERROR/);
 if(scenario.success)assert.match(f.feedback(),scenario.success);
});
test('leaving support before authentication returns never opens the former customer chat',async t=>{
 const before=global.window,tasks=[];global.window={ChannelIO:(...args)=>tasks.push(args)};t.after(()=>global.window=before);
 const f=mount(t,'components/ChannelSupportButton.tsx',{orderId:'order'});let resolve;
 f.respondGet(()=>new Promise(done=>resolve=done));await f.init();
 const pending=f.click('채팅 상담');await flush();f.unmount();
 resolve(Response.json({pluginKey:'fixture',memberId:'old-user',memberHash:'fixture'}));await pending;
 assert.ok(tasks.some(t=>t[0]==='shutdown'));assert.ok(!tasks.some(t=>t[0]==='boot'||t[0]==='showMessenger'));
});
test('late SDK boot callback after leaving support shuts down instead of revealing chat',async t=>{
 const before=global.window,tasks=[];let boot;
 global.window={ChannelIO:(...args)=>{tasks.push(args);if(args[0]==='boot')boot=args[2];}};t.after(()=>global.window=before);
 const f=mount(t,'components/ChannelSupportButton.tsx',{orderId:'order'});f.respondGet(()=>Response.json({pluginKey:'fixture',memberId:'buyer',memberHash:'fixture'}));await f.init();
 const pending=f.click('채팅 상담');await flush();assert.equal(typeof boot,'function');f.unmount();boot(null);await pending;
 assert.ok(!tasks.some(t=>t[0]==='showMessenger'));assert.equal(tasks.at(-1)[0],'shutdown');
});
for(const file of ['components/CustomerShopping.tsx','components/admin/ProductCareEditor.tsx'])for(const mode of ['server','html','network'])test(`${file} handles ${mode} read failures without rendering a false empty state`,async t=>{
 const f=mount(t,file,{productId:'product'});f.respondGet(()=>respond(mode));await f.init();verifyFailure(f,mode);
 assert.doesNotMatch(f.feedback(),/아직 받은 알림이 없습니다|상품·품질 안내 저장/);
});
