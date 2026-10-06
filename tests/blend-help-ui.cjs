const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {load}=require('./support/load.cjs');
const {HELP_TOPICS}=load('lib/blend-help.ts');
const {isFloatingExcludedPath}=load('lib/floating-visibility.ts');

// Exercise the real component handlers/effects. No browser, API, or order data is used.
function fixture(open=true){
 const states=[],refs=[],effectSlots=[],pending=[];let stateIndex=0,refIndex=0,effectIndex=0,tree,closed=0,requests=0;
 const original={document:global.document,HTMLElement:global.HTMLElement,fetch:global.fetch};
 class Element {constructor(){this.isConnected=true;this.focuses=0;}focus(){this.focuses++;global.document.activeElement=this;}}
 const opener=new Element(),closeButton=new Element(),input=new Element();
 const dialog=new Element();Object.assign(dialog,{open:false,shows:0,closes:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;this.closes++;}});
 const scroller={scrollTop:0,scrollHeight:900};
 global.HTMLElement=Element;global.document={activeElement:opener};
 global.fetch=()=>{requests++;throw Error('The local help chat must not send requests');};
 const mockReact={...React,
  useState(initial){const i=stateIndex++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
  useRef(initial){const i=refIndex++;if(!(i in refs))refs[i]={current:initial};return refs[i];},
  useEffect(fn,deps){const i=effectIndex++;const previous=effectSlots[i];if(!previous||deps.some((d,n)=>!Object.is(d,previous[n])))pending.push(fn);effectSlots[i]=deps;},
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
 render();
 return {props,render,flush,find,all,text,button,textarea,form,turns,type,submit,key,log,dialog,opener,closeButton,scroller,closed:()=>closed,requests:()=>requests,tree:()=>tree,close(){Object.assign(global,original);assert.equal(requests,0,'help must remain local and never submit an inquiry');}};
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
