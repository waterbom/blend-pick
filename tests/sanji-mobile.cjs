const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
let pathname='/';
const Frame=load('components/StorefrontFrame.tsx',{'next/navigation':{usePathname:()=>pathname}}).default;
const render=site=>renderToStaticMarkup(React.createElement(Frame,{site},React.createElement('main',null,'content')));
for(const path of ['/','/sanji','/p/example','/products/example/checkout','/cart','/cart/checkout','/orders/lookup','/sanji/mypage','/login']){
 test(`Sanji customer frame covers ${path}`,()=>{pathname=path;assert.match(render('sanjipick'),/class="sanji-mobile-shell"/);assert.match(render('sanjipick'),/<main>content<\/main>/);});
}
for(const path of ['/admin','/admin/orders','/influencer','/partners/products','/sanji/admin/orders']){
 test(`workspace remains unframed at ${path}`,()=>{pathname=path;assert.equal(render('sanjipick'),'<main>content</main>');});
}
test('Blendpick stays unframed and navigating away from admin restores customer frame',()=>{
 pathname='/';assert.equal(render('blendpick'),'<main>content</main>');
 pathname='/admin/orders';assert.equal(render('sanjipick'),'<main>content</main>');
 pathname='/cart';assert.match(render('sanjipick'),/sanji-mobile-shell/);
});
test('store exit reloads the document in the same window so an admin-first visit gets its customer header back',async()=>{
 // A soft Link navigation reuses the root layout, including an initially null server header.
 // The admin exit must use normal document navigation to reevaluate that request context.
 const walk=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,predicate);if(found)return found;}return null;};
 for(const siteKey of ['blendpick','sanjipick'])for(const mode of ['collapsed','expanded','mobile']){
  let state=0;
  const Sidebar=load('components/admin/AdminSidebar.tsx',{
   react:{...React,useEffect(){},useRef:()=>({current:null}),useState(initial){const index=state++;return[index===0?mode==='mobile':index===1?mode==='expanded':initial,()=>{}];}},
   'next/navigation':{usePathname:()=>'/admin/orders'},
   './AdminIcon':()=>null,
  }).default;
  const exit=walk(Sidebar({siteKey}),node=>node.props?.className==='commerce-store-link');
  assert.ok(exit);
  assert.equal(exit.type,'a','normal document navigation must refresh the shared root layout');
  assert.equal(exit.props.href,'/');
  assert.ok(!exit.props.target||exit.props.target==='_self');
  assert.equal(exit.props.onClick,undefined,'no click interception or scroll restoration from the client router');
 }
 let requestPath='/admin/orders';
 const SanjiHeader=load('components/sanji/SanjiHeader.tsx',{'next/navigation':{usePathname:()=>requestPath}}).default;
 const Header=load('components/Header.tsx',{
  '@/lib/site-server':{currentSite:async()=>({key:'sanjipick',nameEn:'SANJI PICK',basePath:'/sanji'})},
  '@/lib/sanji-link':{sanjiLinkBase:async()=>''},
  'next/headers':{headers:async()=>new Headers({'x-pathname':requestPath}),cookies:async()=>({get:key=>key==='admin_token'?{value:'test-session'}:undefined})},
  '@/lib/auth':{verifyAdminToken:async()=>({name:'관리자'})},
  '@/lib/db':{query:async()=>{throw Error('Unexpected database access');}},
  '@/components/HeaderClient':props=>React.createElement(SanjiHeader,{base:props.site.basePath,user:props.user,isAdmin:props.isAdmin,cartCount:null}),
 }).default;
 assert.equal(await Header({storefrontRoot:true}),null);
 requestPath='/';
 const fresh=await Header({storefrontRoot:true});
 assert.equal(fresh.props.isAdmin,true,'same-window navigation keeps the existing admin session');
 const html=renderToStaticMarkup(fresh);
 assert.match(html,/class="sj-wordmark"/);
 assert.match(html,/role="search"/);
 assert.match(html,/aria-label="메뉴 열기"/);
});
test('mobile overrides are valid named container rules, including header and checkout',()=>{
 const css=require('postcss').parse(require('node:fs').readFileSync('app/sanji-mobile.css','utf8'));
 const rules=[];css.walkAtRules(rule=>{assert.equal(rule.name,'container');assert.match(rule.params,/^sanji-mobile \(/);rules.push(rule);});
 assert.ok(rules.some(rule=>rule.toString().includes('.sj-header-nav')));
 assert.ok(rules.some(rule=>rule.toString().includes('.commerce-layout')));
});

test('market home shows latest five image banners, retains closed products, and separates categories',()=>{
 const state=[];let cursor=0;
 const hooks={...React,useRef:()=>({current:null}),useEffect(){},useMemo:fn=>fn(),useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];}};
 const Home=load('components/sanji/SanjiHome.tsx',{'react':hooks,'next/navigation':{useRouter:()=>({refresh(){}})}}).default;
 const product=(id,extra={})=>({id,name:'상품 '+id,brand:'산지',category:'산지픽 농산물',price:10000,original_price:null,main_image:'/test.jpg',stock:5,status:'active',sale_start_at:null,sale_end_at:null,created_at:`2026-10-0${id}T00:00:00Z`,sold:0,...extra});
 const products=[1,2,3,4,5,6].map(id=>product(String(id)));
 products.push(product('closed',{sale_end_at:'2020-01-01'}),product('sea',{category:'산지픽 수산물',created_at:'2026-10-07'}),product('no-image',{main_image:null,created_at:'2026-10-08'}),product('future',{sale_start_at:'2099-01-01'}));
 const render=()=>{cursor=0;return Home({products,reviews:[],linkBase:'/sanji',kakaoUrl:'#'});};
 const walk=(n,p)=>{if(!n||typeof n!=='object')return null;if(p(n))return n;for(const child of React.Children.toArray(n.props?.children)){const found=walk(child,p);if(found)return found;}return null;};
 const html=renderToStaticMarkup(render());
 assert.equal((html.match(/data-banner-product=/g)||[]).length,5);
 for(const id of ['closed','future','no-image','1','2'])assert.ok(!html.includes(`data-banner-product="${id}"`));
 assert.match(html,/마감된 공구/);assert.match(html,/공구가 종료되었어요/);assert.match(html,/href="\/sanji\/p\/closed"/);assert.match(html,/다음 공구 미리보기/);
 const tab=walk(render(),n=>n.props?.role==='tab'&&n.props.children==='수산물');tab.props.onClick();
 const sea=renderToStaticMarkup(render());assert.match(sea,/상품 sea/);assert.doesNotMatch(sea,/상품 1|상품 closed|상품 future/);
});

test('market catalog search retains matching closed items with a clear closed badge',()=>{
 const Catalog=load('components/sanji/SanjiCatalog.tsx',{'@/lib/analytics':{fbqTrack:()=>false}}).default;
 const p={id:'closed',name:'옥수수',brand:'농장',category:'산지픽',price:10000,original_price:null,main_image:null,stock:5,status:'active',sale_start_at:null,sale_end_at:'2020-01-01',created_at:'2020-01-01',sold:0};
 const html=renderToStaticMarkup(React.createElement(Catalog,{products:[p],linkBase:'',initialQuery:'옥수수'}));
 assert.match(html,/공구 마감/);assert.match(html,/공구가 종료되었어요/);assert.match(html,/href="\/p\/closed"/);
 const empty=renderToStaticMarkup(React.createElement(Catalog,{products:[p],linkBase:'',initialQuery:'사과'}));assert.match(empty,/검색 결과가 없어요/);assert.doesNotMatch(empty,/href="\/p\/closed"/);
});

test('compact header and bottom navigation preserve search, account, cart and order destinations',()=>{
 const Header=load('components/sanji/SanjiHeader.tsx',{'next/navigation':{usePathname:()=>'/sanji'},'next/link':props=>React.createElement('a',props)}).default;
 const Nav=load('components/sanji/SanjiBottomNav.tsx').default;
 for(const base of ['', '/sanji']){
  const header=renderToStaticMarkup(React.createElement(Header,{base,user:null,isAdmin:false,cartCount:null}));
  assert.ok(header.includes(`action="${base}/products"`));assert.match(header,/name="q"/);assert.match(header,/aria-label="메뉴 열기"/);
  const nav=renderToStaticMarkup(React.createElement(Nav,{base,active:'catalog'}));
  for(const href of [base||'/',base+'/products','/orders/lookup',base+'/mypage','/cart'])assert.ok(nav.includes(`href="${href}"`));
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
 }
});
