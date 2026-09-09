const test=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./support/load.cjs');
const {trafficPoints,settlementPoints,kstDay}=load('lib/admin-chart-data.ts');
const {default:Chart}=load('components/admin/charts/MetricChart.tsx');
const render=(points,kind='line')=>renderToStaticMarkup(React.createElement(Chart,{title:'검증 그래프',points,series:[{label:'금액',color:'#315e43'}],kind,unit:'won'}));
test('traffic daily latency is weighted by requests',()=>{
 const points=trafficPoints({effectiveFrom:'2026-09-08T15:00:00Z',generatedAt:'2026-09-08T17:00:00Z',hours:[{hour:'2026-09-08T15:00:00Z',requests:10,averageMs:100},{hour:'2026-09-08T16:00:00Z',requests:90,averageMs:300}]},'day','averageMs');
 assert.equal(points.length,1);assert.equal(points[0].values[0],280);assert.equal(points[0].label,'09-09');
});
test('traffic keeps missing bucket null and observed zero as zero',()=>{
 const points=trafficPoints({effectiveFrom:'2026-09-08T15:30:00Z',generatedAt:'2026-09-08T17:30:00Z',hours:[{hour:'2026-09-08T15:00:00Z',requests:0},{hour:'2026-09-08T17:00:00Z',requests:3}]},'hour','requests');
 assert.deepEqual(points.map(p=>p.values[0]),[0,null,3]);assert.equal(points[0].label,'09-09 00시');
});
test('line chart breaks at missing data instead of interpolating',()=>{
 const html=render([{label:'A',values:[2]},{label:'B',values:[null]},{label:'C',values:[4]}]);
 const path=html.match(/<path d="([^"]+)"/)[1];assert.equal((path.match(/M/g)||[]).length,2);assert.ok(!path.includes('L'));assert.match(html,/미확정·기록 없음/);
});
test('negative profit renders a bar below zero with a positive height',()=>{
 const html=render([{label:'손실',values:[-100]}],'bar');assert.doesNotMatch(html,/NaN|Infinity|height="-/);assert.match(html,/-100원/);
});
test('all zero remains valid data, all missing is an unavailable state',()=>{
 assert.match(render([{label:'오늘',values:[0]}]),/<svg/);assert.match(render([{label:'오늘',values:[null]}]),/표시할 확정 데이터가 없습니다/);
});
test('settlement chart includes all rows beyond the 200-row table limit',()=>{
 const rows=Array.from({length:230},()=>({settled_at:'2026-09-09T00:00:00Z',net_amount:100,fee:3}));
 assert.deepEqual(settlementPoints(rows)[0].values,[23000,690]);
 rows[229].net_amount=null;assert.deepEqual(settlementPoints(rows)[0].values,[null,690]);
});
test('long settlement periods group by KST month',()=>{
 assert.deepEqual(settlementPoints([{settled_at:'2026-06-30T16:00:00Z',net_amount:100,fee:1},{settled_at:'2026-09-09T00:00:00Z',net_amount:200,fee:2}]).map(p=>p.label),['2026-07','2026-09']);
});
const base={id:'x',paid_at:'2026-09-08T15:00:00Z',total_amount:10000,shipping_fee:1000,refunds:0,refund_count:0,status:'paid',sales_channel:'display',items:[],fee_estimated:true,payment_method:'카드'};
const calls=[];const {summarizeSales,getSalesSummary}=load('lib/sales-statistics.ts',{'@/lib/db-shop':{query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}}});
test('sales maintains original payment, refund and net with KST boundaries',()=>{
 const s=summarizeSales([base,{...base,sales_channel:'non_display',total_amount:8000,refunds:3000,refund_count:1}],7,new Date('2026-09-09T04:00:00Z'));
 assert.equal(s.daily.length,7);assert.equal(s.daily.at(-1).label,'2026-09-09');assert.deepEqual([s.totals.gross,s.totals.refunds,s.totals.net,s.totals.orders],[18000,3000,15000,2]);assert.equal(s.channels[1].net,5000);assert.equal(s.daily[0].gross,0);
});
test('unresolved refunds invalidate only affected day/channel and total net',()=>{
 const s=summarizeSales([base,{...base,paid_at:'2026-09-08T00:00:00Z',sales_channel:'non_display',pending_refunds:true}],7,new Date('2026-09-09T04:00:00Z'));
 assert.equal(s.totals.net,null);assert.equal(s.totals.unresolved,1);assert.equal(s.channels[0].net,10000);assert.equal(s.channels[1].net,null);assert.equal(s.daily.at(-1).net,10000);assert.equal(s.daily.at(-2).net,null);
});
test('sales loader applies site and paid-only non-test date constraints before aggregating',async()=>{
 await getSalesSummary('sanjipick',7,new Date('2026-09-09T04:00:00Z'));const q=calls.at(-1);
 assert.deepEqual(q.args,['sanjipick','2026-09-03','2026-09-09']);assert.match(q.sql,/o.site=\$1/);assert.match(q.sql,/o.paid_at IS NOT NULL/);assert.match(q.sql,/NOT LIKE 'SIM_%'/);
});
test('visit chart never draws a collection error as zero visitors',()=>{
 const View=load('components/admin/charts/VisitCharts.tsx').default;
 assert.equal(renderToStaticMarkup(React.createElement(View,{data:{state:'error',daily:[],pages:[]}})),'');
});
for(const route of ['visits','traffic','monitoring']) test(`${route} denies unauthenticated access before site/data access`,async()=>{
 const Page=load(`app/admin/(protected)/${route}/page.tsx`,{'next/headers':{cookies:async()=>({get:()=>undefined})},'next/navigation':{redirect:()=>{throw Error('LOGIN')}},'@/lib/auth':{verifyAdminToken:async()=>null},'@/lib/admin-site':{currentAdminSite:()=>{throw Error('site lookup before auth')}},'@/lib/visit-analytics/store':{getVisitSummary:()=>{throw Error('visit query before auth')}},'@/lib/server-traffic':{getServerTraffic:()=>{throw Error('traffic read before auth')}}}).default;
 await assert.rejects(Page({searchParams:Promise.resolve({})}),/LOGIN/);
});
test('dashboard contains only daily sales and order charts with links to detailed pages',()=>{
 const View=load('components/admin/charts/SalesCharts.tsx').default;
 const data=summarizeSales([],7,new Date('2026-09-09T04:00:00Z'));
 const html=renderToStaticMarkup(React.createElement(View,{data}));
 assert.equal((html.match(/<svg/g)||[]).length,2);assert.match(html,/href="\/admin\/link-sales"/);assert.doesNotMatch(html,/전시·비전시 매출 비교/);
});
test('visits-only view excludes server traffic and automatic check panels',()=>{
 const View=load('components/admin/MonitoringOverview.tsx').default;
 const data={state:'empty',days:7,from:'2026-09-03T00:00:00Z',to:'2026-09-09T04:00:00Z',daily:[],pages:[],totals:{visitors:0,sessions:0,pageviews:0},lastEventAt:null};
 const html=renderToStaticMarkup(React.createElement(View,{siteName:'산지픽',summary:data,visitsOnly:true}));
 assert.match(html,/방문 통계/);assert.doesNotMatch(html,/자동 점검|서버 트래픽|점검 실행 기록/);
});
for(const route of ['visits','traffic']) test(`${route} loads only its own site's requested statistics`,async()=>{
 let called=0;
 const mocks={'next/headers':{cookies:async()=>({get:()=>({value:'test-admin'})})},'next/navigation':{redirect:()=>{throw Error('unexpected login')}},'@/lib/auth':{verifyAdminToken:async()=>({role:'admin'})},'@/lib/admin-site':{currentAdminSite:async()=>({key:'sanjipick',name:'산지픽'})},'@/components/admin/MonitoringOverview':()=>null,'@/components/admin/ServerTrafficPanel':()=>null,'@/lib/visit-analytics/store':{getVisitSummary:async(site,days)=>{assert.equal(route,'visits');assert.equal(site,'sanjipick');assert.equal(days,30);called++;return {}; }},'@/lib/server-traffic':{getServerTraffic:async(site,days)=>{assert.equal(route,'traffic');assert.equal(site,'sanjipick');assert.equal(days,30);called++;return {};}}};
 const Page=load(`app/admin/(protected)/${route}/page.tsx`,mocks).default;await Page({searchParams:Promise.resolve({days:'30'})});assert.equal(called,1);
});
