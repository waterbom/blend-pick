const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./support/load.cjs');
const {HELP_TOPICS}=load('lib/blend-help.ts');
const {isFloatingExcludedPath}=load('lib/floating-visibility.ts');
const {chatMessages,readChatStream}=load('lib/blend-chat-client.ts');

// Exercise real handlers/effects with an in-memory same-origin API stub. No external API or order data is used.
function fixture(open=true,{enabled=false,post}={}){
 const states=[],refs=[],effectSlots=[],pending=[];let stateIndex=0,refIndex=0,effectIndex=0,tree,closed=0,requests=0,configRequests=0;
 const original={document:global.document,HTMLElement:global.HTMLElement,fetch:global.fetch,window:global.window};
 class Element {constructor(){this.isConnected=true;this.focuses=0;}focus(){this.focuses++;global.document.activeElement=this;}}
 const opener=new Element(),closeButton=new Element(),input=new Element();
 const dialog=new Element();Object.assign(dialog,{open:false,shows:0,closes:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;this.closes++;}});
 const scroller={scrollTop:0,scrollHeight:900};
 global.HTMLElement=Element;global.document={activeElement:opener};
 global.window={location:{pathname:'/products/example'}};
 global.fetch=(url,options={})=>{
  assert.equal(url,'/api/help/chat','only the same-origin chat endpoint may be fetched');
  if(options.method!=='POST'){configRequests++;return Promise.resolve(Response.json({enabled}));}
  requests++;assert.ok(post,'FAQ mode must never make a chat request');return post(options);
 };
 const mockReact={...React,
  useState(initial){const i=stateIndex++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
  useRef(initial){const i=refIndex++;if(!(i in refs))refs[i]={current:initial};return refs[i];},
  useCallback(fn){return fn;},
  useEffect(fn,deps){const i=effectIndex++;const previous=effectSlots[i];
   // useCallback callbacks are stable in React; this minimal fixture compares non-function dependencies.
   if(!previous||deps.some((d,n)=>typeof d!=='function'&&!Object.is(d,previous.deps[n])))pending.push(()=>{previous?.cleanup?.();effectSlots[i].cleanup=fn();});
   effectSlots[i]={deps,cleanup:previous?.cleanup};
  },
 };
 const Link=()=>null;
 const Chat=load('components/blend/BlendHelpChat.tsx',{'react':mockReact,'next/link':Link,'./BlendHelpChat.module.css':{},'@/components/blend/BlendHelpChat.module.css':{}}).default;
 const props={open,onClose:()=>{closed++;},kakaoUrl:'https://pf.kakao.com/_VyING/chat'};
 const all=(node,predicate,out=[])=>{if(!node||typeof node!=='object')return out;if(predicate(node))out.push(node);for(const child of React.Children.toArray(node.props?.children))all(child,predicate,out);return out;};
 const find=predicate=>all(tree,predicate)[0];
 const text=node=>node==null?'':typeof node==='string'||typeof node==='number'?String(node):React.Children.toArray(node.props?.children).map(text).join('');
 function render(){stateIndex=refIndex=effectIndex=0;tree=Chat(props);for(const node of all(tree,n=>n.props?.ref)){let target;if(node.type==='dialog')target=dialog;else if(node.type==='textarea')target=input;else if(node.props['aria-label']==='도우미 닫기')target=closeButton;else if(node.type==='div')target=scroller;if(target)node.props.ref.current=target;}return tree;}
 const flush=()=>{while(pending.length)pending.shift()();};
 const textarea=()=>find(n=>n.type==='textarea');
 const form=()=>find(n=>n.type==='form');
 const button=label=>find(n=>n.type==='button'&&n.props['aria-label']===label);
 const log=()=>find(n=>n.props?.role==='log');
 const turns=()=>React.Children.toArray(log().props.children);
 const type=value=>{textarea().props.onChange({target:{value}});render();};
 const submit=()=>{let prevented=false;form().props.onSubmit({preventDefault(){prevented=true;}});render();return prevented;};
 const key=extra=>{let prevented=false;textarea().props.onKeyDown({key:'Enter',shiftKey:false,nativeEvent:{isComposing:false},keyCode:13,preventDefault(){prevented=true;},...extra});render();return prevented;};
 const settle=async()=>{for(let i=0;i<30;i++){await Promise.resolve();render();flush();}};
 render();
 return {props,render,flush,settle,find,all,text,button,textarea,form,turns,type,submit,key,log,dialog,opener,closeButton,scroller,closed:()=>closed,requests:()=>requests,configRequests:()=>configRequests,tree:()=>tree,close(){for(const slot of effectSlots)slot?.cleanup?.();Object.assign(global,original);}};
}

test('FAQ and typed questions produce local replies and links without submitting an inquiry',()=>{
 const f=fixture();try{
  const faq=f.find(n=>n.type==='button'&&f.text(n).startsWith(HELP_TOPICS[0].question));assert.ok(faq);faq.props.onClick();f.render();
  assert.equal(f.turns().length,1);assert.match(f.text(f.log()),/주문·배송 조회/);assert.ok(f.find(n=>n.props?.href==='/orders/lookup'));
  assert.equal(f.find(n=>n.props?.id==='blend-help-topics'),undefined);
  f.find(n=>n.props?.['aria-controls']==='blend-help-topics').props.onClick();f.render();assert.ok(f.find(n=>n.props?.id==='blend-help-topics'));
  f.type('  교육 클래스 공구 제안  ');assert.equal(f.submit(),true);assert.equal(f.turns().length,2);assert.match(f.text(f.turns()[1]),/교육 클래스 공구 제안/);assert.ok(f.find(n=>n.props?.href==='/suppliers'));assert.equal(f.textarea().props.value,'');
  const contact=f.find(n=>n.type==='a'&&f.text(n).includes('상담원 연결'));assert.equal(contact.props.href,'https://pf.kakao.com/_VyING/chat');assert.equal(contact.props.target,'_blank');assert.match(contact.props.rel,/noopener/);contact.props.onClick();assert.equal(f.closed(),1);assert.equal(f.requests(),0);
 }finally{f.close();}
});

test('Enter sends once while Shift+Enter and Korean IME composition remain unsent',()=>{
 const f=fixture();try{
  f.type('공구 일정');assert.equal(f.key({shiftKey:true}),false);assert.equal(f.turns().length,0);
  assert.equal(f.key({nativeEvent:{isComposing:true}}),false);assert.equal(f.turns().length,0);
  assert.equal(f.key({keyCode:229}),false);assert.equal(f.turns().length,0);
  assert.equal(f.key({key:'a',keyCode:65}),false);assert.equal(f.turns().length,0);
  assert.equal(f.key({}),true);assert.equal(f.turns().length,1);assert.match(f.text(f.log()),/달력/);assert.equal(f.textarea().props.value,'');
  assert.equal(f.key({}),true);assert.equal(f.turns().length,1);
 }finally{f.close();}
});

test('empty and overlong questions are blocked, and a 500-character question is accepted',()=>{
 const f=fixture();try{
  assert.equal(f.textarea().props.maxLength,500);f.type(' \n  ');assert.equal(f.button('질문 보내기').props.disabled,true);f.submit();assert.equal(f.turns().length,0);
  f.type('가'.repeat(501));f.submit();assert.equal(f.turns().length,0);assert.match(f.text(f.find(n=>n.props?.id==='blend-help-feedback')),/500자 이내/);assert.equal(f.textarea().props.value.length,501);
  f.type('가'.repeat(500));assert.equal(f.text(f.find(n=>n.props?.id==='blend-help-feedback')),'');f.submit();assert.equal(f.turns().length,1);assert.equal(f.textarea().props.value,'');
 }finally{f.close();}
});

test('twenty-turn limit blocks repeated submissions and reset starts a clean usable conversation',()=>{
 const f=fixture();try{
  f.flush();for(let i=0;i<20;i++){f.type(`배송 ${i}`);f.submit();}
  f.flush();assert.equal(f.turns().length,20);assert.equal(f.textarea().props.disabled,true);assert.equal(f.button('질문 보내기').props.disabled,true);assert.equal(f.find(n=>n.props?.id==='blend-help-topics'),undefined);assert.equal(f.scroller.scrollTop,900);
  f.type('추가 질문');f.submit();f.key({});assert.equal(f.turns().length,20);
  f.button('새 대화 시작').props.onClick();f.render();f.flush();assert.equal(f.turns().length,0);assert.equal(f.textarea().props.value,'');assert.equal(f.textarea().props.disabled,false);assert.ok(f.find(n=>n.props?.id==='blend-help-topics'));assert.match(f.text(f.find(n=>n.props?.id==='blend-help-feedback')),/새 대화/);assert.equal(f.scroller.scrollTop,0);
  f.type('비회원 구매');f.submit();assert.equal(f.turns().length,1);
 }finally{f.close();}
});

test('native dialog opens once, Escape and close controls notify the parent, and focus returns on close',()=>{
 const f=fixture(false);try{
  f.flush();assert.equal(f.dialog.shows,0);
  f.props.open=true;f.render();f.flush();assert.equal(f.dialog.open,true);assert.equal(f.dialog.shows,1);assert.equal(f.closeButton.focuses,1);
  f.render();f.flush();assert.equal(f.dialog.shows,1);
  let prevented=false;f.tree().props.onCancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.closed(),1);
  f.props.open=false;f.render();f.flush();assert.equal(f.dialog.open,false);assert.equal(f.dialog.closes,1);assert.equal(f.opener.focuses,1);
  f.props.open=true;f.render();f.flush();f.button('도우미 닫기').props.onClick();assert.equal(f.closed(),2);
  f.tree().props.onClose();assert.equal(f.closed(),3);
 }finally{f.close();}
});

test('floating tools use the same route exclusions across twenty-six public and protected paths',()=>{
 const hidden=['/admin','/admin/products/123','/partners','/partners/orders','/influencer','/influencer/products','/sanji','/sanji/products','/pay','/pay/confirm','/hotel/dangung','/hotel/dangung/result','/checkout','/products/123/checkout','/cart/checkout'];
 const visible=['/','/products','/products/123','/suppliers','/orders/lookup','/cart','/hotel','/hotel/lookup','/hotel/utop','/privacy','/administer'];
 assert.equal(hidden.length+visible.length,26);
 for(const path of hidden)assert.equal(isFloatingExcludedPath(path),true,path);
 for(const path of visible)assert.equal(isFloatingExcludedPath(path),false,path);
});


function streamResponse(events){
 const source=events.map(event=>JSON.stringify(event)+'\n').join('');
 return new Response(source,{headers:{'Content-Type':'application/x-ndjson'}});
}

test('enabled chat streams an answer, remembers the conversation, and labels AI provenance',async()=>{
 const bodies=[];
 const f=fixture(true,{enabled:true,post:async options=>{
  bodies.push(JSON.parse(options.body));
  return streamResponse([{type:'start',mode:'ai'},{type:'delta',text:'숙박 공구도 '},{type:'delta',text:'안내할 수 있어요.'},{type:'done',links:[{label:'숙박 보기',href:'/hotel'}]}]);
 }});
 try{
  f.flush();await f.settle();assert.match(f.text(f.tree()),/AI 대화 안내/);assert.match(f.text(f.find(n=>n.props?.id==='blend-help-privacy')),/OpenAI/);
  f.type('숙박은요?');f.submit();assert.equal(f.button('질문 보내기').props.disabled,true);assert.ok(f.button('답변 생성 멈추기'));
  await f.settle();assert.match(f.text(f.log()),/숙박 공구도 안내할 수 있어요/);assert.match(f.text(f.log()),/도우미 AI/);assert.ok(f.find(n=>n.props?.href==='/hotel'));assert.equal(f.button('답변 생성 멈추기'),undefined);
  f.type('그럼 예약 확인은?');f.submit();await f.settle();assert.equal(bodies.length,2);assert.equal(bodies[1].pagePath,'/products/example');assert.deepEqual(bodies[1].messages,[{role:'user',content:'숙박은요?'},{role:'assistant',content:'숙박 공구도 안내할 수 있어요.'},{role:'user',content:'그럼 예약 확인은?'}]);
 }finally{f.close();}
});

test('a synchronous duplicate submission creates only one AI request',async()=>{
 let release;
 const f=fixture(true,{enabled:true,post:()=>new Promise(resolve=>{release=resolve;})});
 try{
  f.flush();await f.settle();f.type('배송 확인');const submit=f.form().props.onSubmit;
  submit({preventDefault(){}});submit({preventDefault(){}});f.render();assert.equal(f.requests(),1);assert.equal(f.turns().length,1);
  release(streamResponse([{type:'fallback',answer:'주문 조회에서 확인해 주세요.',links:[]}]));await f.settle();assert.match(f.text(f.log()),/기본 안내/);assert.match(f.text(f.log()),/AI 답변 대신 기본 안내/);
 }finally{f.close();}
});

test('network failures and incomplete streams replace partial AI text with visibly basic guidance',async()=>{
 for(const post of [()=>Promise.reject(Error('offline')),async()=>streamResponse([{type:'start',mode:'ai'},{type:'delta',text:'확인되지 않은 답변'}]),async()=>Response.json({error:'요청이 많아요'},{status:429})]){
  const f=fixture(true,{enabled:true,post});try{
   f.flush();await f.settle();f.type('배송 확인');f.submit();await f.settle();assert.match(f.text(f.log()),/기본 안내/);assert.match(f.text(f.log()),/AI 연결이 원활하지 않아/);assert.match(f.text(f.log()),/주문·배송 조회/);assert.doesNotMatch(f.text(f.log()),/확인되지 않은 답변/);assert.equal(f.button('답변 생성 멈추기'),undefined);
  }finally{f.close();}
 }
});

test('stop, reset, close, and unmount abort requests and ignore late responses',async()=>{
 for(const action of ['stop','reset','close','unmount']){
  let release,signal;
  const f=fixture(true,{enabled:true,post:options=>{signal=options.signal;return new Promise(resolve=>{release=resolve;});}});
  let restored=false;
  try{
   f.flush();await f.settle();f.type('예약 확인');f.submit();assert.equal(signal.aborted,false);
   if(action==='stop')f.button('답변 생성 멈추기').props.onClick();
   if(action==='reset')f.button('새 대화 시작').props.onClick();
   if(action==='close')f.button('도우미 닫기').props.onClick();
   if(action==='unmount'){f.close();restored=true;}
   assert.equal(signal.aborted,true);f.render();
   if(action!=='reset')assert.match(f.text(f.log()),/중단됨/);
   else assert.equal(f.turns().length,0);
   release(streamResponse([{type:'delta',text:'뒤늦은 답변'},{type:'done',links:[]} ]));
   if(!restored){await f.settle();assert.doesNotMatch(f.text(f.log()),/뒤늦은 답변/);assert.equal(f.button('답변 생성 멈추기'),undefined);}
   else await Promise.resolve();
  }finally{if(!restored)f.close();}
 }
});

test('history includes at most four complete pairs and stays within the request budget',()=>{
 const make=(i,status='complete')=>({question:`질문 ${i}`,reply:{answer:`답변 ${i}`,links:[]},status});
 const history=[...Array.from({length:7},(_,i)=>make(i)),make(7,'stopped'),make(8,'pending')];
 const messages=chatMessages(history,'마지막');assert.equal(messages.length,9);assert.equal(messages[0].content,'질문 3');assert.equal(messages.at(-1).content,'마지막');
 const large=Array.from({length:4},()=>({question:'가'.repeat(600),reply:{answer:'나'.repeat(6000),links:[]},status:'complete'}));
 const bounded=chatMessages(large,'다'.repeat(500));assert.ok(bounded.reduce((n,m)=>n+m.content.length,0)<=12000);assert.equal(bounded.length%2,1);assert.ok(bounded.every(m=>m.content.length<=(m.role==='user'?500:4000)));
});

test('NDJSON decoder preserves split Korean UTF-8 and only exposes safe server links',async()=>{
 const bytes=new TextEncoder().encode([{type:'delta',text:'안녕하세요 <script>alert(1)</script>'},{type:'done',links:[{label:'상품',href:'/products'},{label:'악성',href:'javascript:alert(1)'},{label:'외부',href:'//example.com'},{label:'외부',href:'https://example.com'},{label:'카톡',href:'https://pf.kakao.com/_VyING/chat'}]}].map(e=>JSON.stringify(e)+'\n').join(''));
 let index=0;
 const response=new Response(new ReadableStream({pull(controller){if(index===bytes.length){controller.close();return;}controller.enqueue(bytes.slice(index,index+1));index++;}}),{headers:{'Content-Type':'application/x-ndjson'}});
 const events=[];await readChatStream(response,new AbortController().signal,event=>events.push(event));assert.equal(events[0].text,'안녕하세요 <script>alert(1)</script>');assert.deepEqual(events[1].links.map(l=>l.href),['/products','https://pf.kakao.com/_VyING/chat']);
});


test('partial text is visible while streaming and stopping cancels the response reader',async()=>{
 let streamController,signal,cancelled=false;
 const stream=new ReadableStream({start(controller){streamController=controller;},cancel(){cancelled=true;}});
 const f=fixture(true,{enabled:true,post:async options=>{signal=options.signal;return new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}});}});
 try{
  f.flush();await f.settle();f.type('현재 진행 중인 공구는?');f.submit();await f.settle();
  streamController.enqueue(new TextEncoder().encode(JSON.stringify({type:'delta',text:'진행 중인 상품을 확인해 볼게요.'})+'\n'));await f.settle();
  assert.match(f.text(f.log()),/진행 중인 상품을 확인해 볼게요/);assert.ok(f.button('답변 생성 멈추기'));assert.equal(f.find(n=>n.props?.['aria-busy']===true)!==undefined,true);
  f.button('답변 생성 멈추기').props.onClick();await f.settle();assert.equal(signal.aborted,true);assert.equal(cancelled,true);assert.match(f.text(f.log()),/중단됨/);assert.doesNotMatch(f.text(f.log()),/답변을 작성하고 있어요/);assert.equal(f.button('답변 생성 멈추기'),undefined);
 }finally{f.close();}
});
