const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
const {adminPrimaryLinks,adminSupportingGroups}=load('lib/admin-navigation.ts');
const {overviewWorkItems,overviewVisitPoints}=load('lib/admin-overview.ts');
const visits={site:'sanjipick',days:7,state:'active',from:'2026-10-14T00:00:00+09:00',to:'2026-10-20T15:00:00+09:00',lastEventAt:'2026-10-20T05:00:00Z',totals:{visitors:20,sessions:25,pageviews:40},daily:[{day:'2026-10-20',visitors:20,sessions:25,pageviews:40}],pages:[{page:'product',views:40}]};
const item=(id,priority='today')=>({id,label:'주문 '+id,detail:'확인 사유',href:'/admin/orders/'+id,elapsed:'결제 후 3일 경과',priority,nextAction:'주문 확인',actionLabel:'상세 확인'});
const group=(key,items,total=items.length)=>({key,title:key,items,total,explanation:'설명',steps:[],resolvedWhen:'처리 완료',sortLabel:'오래된 순'});
const link=({href,children,prefetch,...props})=>React.createElement('a',{href,...props},children);
const viewMocks={'next/link':link,'next/navigation':{useRouter:()=>({refresh(){}}),usePathname:()=>'/admin'}};
function setup({authenticated=true,site='sanjipick',failures=[]}={}){
 const calls=[],errors=[];
 const read=(name,value)=>async(...args)=>{calls.push([name,...args]);if(failures.includes(name))throw Error(name+' unavailable');return value;};
 const mocks={...viewMocks,
  'next/headers':{cookies:async()=>({get:()=>authenticated?{value:'isolated'}:undefined})},
  'next/navigation':{...viewMocks['next/navigation'],redirect:href=>{throw Error('REDIRECT '+href)}},
  '@/lib/auth':{verifyAdminToken:async()=>authenticated?{}:null},
  '@/lib/admin-site':{currentAdminSite:read('site',{key:site,name:site==='sanjipick'?'산지픽':'블랜드픽'})},
  '@/lib/db-shop':{query:read('counts',{rows:[{live_gongu:2,upcoming:1,new_orders:4,preparing_orders:3,shipped_orders:8}]})},
  '@/lib/sales-statistics':{getSalesSummary:read('sales',null)},
  '@/lib/settlement-view':{settlementView:read('settlements',[]),settlementTotal:()=>1234},
  '@/lib/operations':{getTodayWork:read('work',[group('cancellations',[item('same','first')])])},
  '@/lib/automation-work':{getAutomationWork:read('automation',[group('payment-recovery',[item('same','first')])])},
  '@/lib/visit-analytics/store':{getVisitSummary:read('visits',{...visits,site})},
  '@/lib/server-traffic':{getServerTraffic:read('traffic',{site,state:'unavailable'})},
  '@/lib/api-errors':{reportApiError:(_error,operation)=>errors.push(operation)},
 };
 return {Page:load('app/admin/(protected)/page.tsx',mocks).default,calls,errors};
}
test('overview authenticates before any site, finance, work, visit or traffic reads',async()=>{
 const f=setup({authenticated:false});await assert.rejects(f.Page({searchParams:Promise.resolve({days:'30'})}),/REDIRECT \/login/);assert.deepEqual(f.calls,[]);
});
for(const site of ['blendpick','sanjipick'])test(`${site} overview keeps every source host-scoped and applies one period to sales and visits`,async()=>{
 const f=setup({site}),result=await f.Page({searchParams:Promise.resolve({days:'30'})});
 for(const name of ['sales','settlements','work','automation','visits','traffic'])assert.equal(f.calls.find(c=>c[0]===name)[1],site,name);
 for(const name of ['sales','visits'])assert.equal(f.calls.find(c=>c[0]===name)[2],30);
 for(const c of f.calls.filter(c=>c[0]==='counts')){assert.equal(c[2][0],site);assert.match(c[1],/\$1/);}
 assert.equal(result.props.stats.todaySettlement,1234);assert.equal(result.props.stats.preparingOrders,3);assert.equal(result.props.workGroups.length,2);
});
test('partial work or statistics failure stays explicit and preserves remaining actionable work',async()=>{
 const f=setup({failures:['work','visits','settlements']});const {props}=await f.Page({searchParams:Promise.resolve({days:'unsupported'})});
 assert.deepEqual(props.workGroups.map(g=>g.key),['payment-recovery']);assert.deepEqual(props.workUnavailable,['주문·재고 업무']);
 assert.equal(props.visits.state,'error');assert.equal(props.visits.days,7);assert.equal(props.visits.totals,null);assert.equal(props.stats.todaySettlement,null);
 assert.equal(f.errors.length,3);assert.equal(f.calls.find(c=>c[0]==='sales')[2],7);
});
test('urgent cancellation/payment entries stay first and shared order IDs stay distinct',()=>{
 const groups=[group('stock',[item('stock')]),group('payment-recovery',[item('same','first')]),group('cancellations',[item('same','first')])];
 const rows=overviewWorkItems(groups);assert.deepEqual(rows.map(r=>r.group),['cancellations','payment-recovery','stock']);assert.equal(new Set(rows.map(r=>r.key)).size,3);assert.equal(rows[0].href,'/admin/orders/same');
});
test('overview visit chart preserves pre-collection gaps and observed zero',()=>{
 const points=overviewVisitPoints({...visits,daily:[{day:'2026-10-19',visitors:0,pageviews:0,sessions:0},...visits.daily]});
 assert.equal(points.length,7);assert.deepEqual(points[0].values,[null,null]);assert.deepEqual(points.at(-2).values,[0,0]);assert.deepEqual(points.at(-1).values,[20,40]);
});
test('core navigation is directly visible and system tools do not duplicate integrated screens',()=>{
 for(const site of ['blendpick','sanjipick']){
  const primary=adminPrimaryLinks(site),support=adminSupportingGroups(site).flatMap(g=>g.items);
  for(const href of ['/admin','/admin/orders','/admin/shipments','/admin/products','/admin/settlements'])assert(primary.some(i=>i.href===href));
  assert(!support.some(i=>primary.some(p=>p.href===i.href)));
  assert(!support.some(i=>['/admin/operations','/admin/visits','/admin/monitoring'].includes(i.href)));
  const Sidebar=load('components/admin/AdminSidebar.tsx',viewMocks).default;
  const html=renderToStaticMarkup(React.createElement(Sidebar,{siteKey:site})),visible=html.split('<details')[0];
  assert.match(visible,/href="\/admin\/orders"/);assert.match(visible,/href="\/admin\/shipments"/);assert.doesNotMatch(html,/즐겨찾기|전체 메뉴 펼치기/);
  assert.equal(/href="\/admin\/reservations"/.test(html),site==='blendpick');
 }
});
test('urgent tasks render without opening any accordion and retain direct order actions',()=>{
 const View=load('components/admin/OverviewWorkQueue.tsx',viewMocks).default;
 const html=renderToStaticMarkup(React.createElement(View,{groups:[group('cancellations',[item('cancel','first')]),group('stock',Array.from({length:8},(_,i)=>item('stock'+i)))]}));
 assert.match(html,/주문 cancel/);assert.match(html,/href="\/admin\/orders\/cancel"/);assert.match(html,/나머지 3개 항목 더 보기/);assert.doesNotMatch(html,/<details/);
});
test('failed work is not presented as a healthy empty list',()=>{
 const View=load('components/admin/OverviewWorkQueue.tsx',viewMocks).default;
 const html=renderToStaticMarkup(React.createElement(View,{groups:[],unavailable:['주문·재고 업무']}));
 assert.match(html,/role="alert"/);assert.doesNotMatch(html,/현재 확인이 필요한 항목이 없습니다/);assert.match(html,/조회 실패 항목은 다시 확인/);
});
for(const [route,expected] of [['operations','/admin#work'],['visits','/admin?days=30#visits'],['monitoring','/admin/traffic#checks']])test(`${route} bookmark resolves to its integrated destination after authentication`,async()=>{
 const Page=load(`app/admin/(protected)/${route}/page.tsx`,{'next/headers':{cookies:async()=>({get:()=>({value:'test'})})},'@/lib/auth':{verifyAdminToken:async()=>({})},'next/navigation':{redirect:href=>{throw Error(href)}}}).default;
 await assert.rejects(Page({searchParams:Promise.resolve({days:'30'})}),error=>error.message===expected);
});

test('the integrated home shows one shared period selector, direct work, and honest unavailable metrics',()=>{
 const View=load('components/admin/AdminDashboardView.tsx',viewMocks).default;
 const props={siteKey:'sanjipick',siteName:'산지픽',date:'2026. 10. 20',stats:null,sales:null,visits:{...visits,state:'error',totals:null,daily:[],pages:[]},workGroups:[],workUnavailable:['주문·재고 업무']};
 const html=renderToStaticMarkup(React.createElement(View,props));
 assert.equal((html.match(/aria-label="매출·방문 공통 조회 기간"/g)||[]).length,1);
 assert.match(html,/먼저 확인할 일/);assert.match(html,/기간 내 방문자/);assert.match(html,/방문 통계 조회 실패/);assert.match(html,/확인 필요/);
 assert.doesNotMatch(html,/NaN|Infinity|판매 운영, 다음 단계로|공구 파트너 관리|단궁 예약·요금/);
 assert.doesNotMatch(html,/href="\/admin\/(operations|visits|monitoring)"/);
});
