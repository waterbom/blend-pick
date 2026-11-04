const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {PGlite}=require('@electric-sql/pglite');
const m=load('lib/admin-insights.ts');
const at='2026-11-03T00:00:00Z';
const order=(hours,extra={})=>({status:'paid',order_type:'shop',paid_at:new Date(Date.parse(at)-hours*3600000).toISOString(),items:[],...extra});
test('queue boundaries, future shipments, invalid timestamps and drilldown use the same rules',()=>{
  assert.deepEqual([0,23.99,24,72,168,-1].map(h=>m.queueBucket(order(h),at)),['day1','day1','day3','day7','older','unknown']);
  assert.equal(m.queueBucket(order(300,{items:[{product_id:'p',expected_ship_date:'2026-11-04'},{product_id:null,product_name:'[추가] 포장'}]}),at),'planned');
  assert.equal(m.queueBucket(order(300,{items:[{product_id:'p',expected_ship_date:'2026-11-04'},{product_id:'q'}]}),at),'older');
  assert.equal(m.queueBucket(order(300,{status:'shipped',items:[{product_id:'p',expected_ship_date:'2026-11-04'}]}),at),'older');
  assert.equal(m.queueBucket(order(3,{paid_at:null}),at),'unknown');
  const orders=[order(24),order(24,{test_payment:true}),order(24,{order_type:'hotel'}),order(168,{status:'confirmed'})];
  const summary=m.summarizeQueue(orders,at);assert.equal(summary.total,2);
  for(const row of summary.rows) for(const [i,bucket] of m.QUEUE_BUCKETS.entries()) {
    const url=new URL(m.queueFilterHref(row.status,bucket.key,at),'https://example.test');
    const {filter,error}=m.parseQueueFilter(Object.fromEntries(url.searchParams));
    assert.equal(error,'');assert.equal(orders.filter(o=>m.matchesQueueFilter(o,filter)).length,row.values[i]);
  }
  assert(m.parseQueueFilter({qStatus:'paid',qAge:'bad',qAt:at}).error);
});
test('product ranking withholds uncertain quantities and preserves period in detail links',()=>{
  const counts={paid:7,cancelled:1,returned:1,sold:5,orders:2,review:0,pending:1,options:[]};
  const rows=m.productInsightRows([{id:'a',name:'가'},{id:'b',name:'나'},{id:'c',name:'다'}],{a:counts,b:{...counts,review:1}},{a:{gross:100,net:80},b:{gross:90,net:null}},'2026-10-01','2026-10-31');
  assert.deepEqual(m.rankProducts(rows,'sold').map(r=>r.id),['a']);assert.equal(rows[1].net,null);assert.equal(rows[2].sold,null);
  assert.match(rows[0].href,/from=2026-10-01&to=2026-10-31/);assert.equal(rows[0].pending,1);
});
test('return range is KST request date; unknown completion times never become zero duration',()=>{
  assert.deepEqual(m.readReturnRange({},Date.parse('2026-11-02T16:00Z')).range,{from:'2026-10-05',to:'2026-11-03',kind:'all'});
  for(const q of [{returnsFrom:'2026-02-30'},{returnsFrom:'2026-12-01',returnsTo:'2026-11-01'},{returnsKind:['all']}])assert(m.readReturnRange(q).error);
  const range={from:'',to:'',kind:'all'},records=[{kind:'return',reason:'기타 사유',status:'done',created_at:at,done_at:null},{kind:'exchange',reason:'단순 변심',status:'done',created_at:at,done_at:'2026-11-04T00:00Z'},{kind:'return',reason:null,status:'done',created_at:at,done_at:'2026-11-06T00:00Z'}];
  const s=m.summarizeReturns(records);assert.equal(s.total,3);assert.equal(s.medianHours,48);assert.equal(s.timedCompletions,2);assert.equal(s.durations.at(-1).count,1);
  assert.equal(s.reasons.at(-1).count,2);
  const url=new URL(m.returnInsightHref(range,{duration:'day3'}),'https://example.test');
  assert.deepEqual(m.readReturnListFilter(Object.fromEntries(url.searchParams),range),{...range,status:'done',duration:'day3'});
  assert.equal(m.readReturnListFilter({returnsDuration:'day3',returnsStatus:'requested'},range),null);
});
test('charts expose exact counts, accessible links, empty and failed states',()=>{
  const mocks={'next/link':({prefetch,children,...p})=>React.createElement('a',p,children)};
  const Queue=load('components/admin/charts/OrderQueueChart.tsx',mocks).default;
  const html=renderToStaticMarkup(React.createElement(Queue,{data:m.summarizeQueue([order(24)],at)}));
  assert.match(html,/qStatus=paid&amp;qAge=day3/);assert.match(html,/구간별 건수와 주문 목록/);
  assert.match(renderToStaticMarkup(React.createElement(Queue,{data:null})),/role="alert"/);
  const Product=load('components/admin/charts/ProductPerformanceChart.tsx',mocks).default;
  const p=m.productInsightRows([{id:'a',name:'상품'}],{a:{sold:4,paid:4,review:1,options:[{key:'a',label:'옵션',sold:4,paid:4,cancelled:0,returned:0,pending:0,review:1}]}},null);
  const productHtml=renderToStaticMarkup(React.createElement(Product,{rows:p}));
  assert.match(productHtml,/구성비는 확정 후/);assert.doesNotMatch(productHtml,/>[^<]*100\.0%/);
});
test('database aggregates exceed 200, stay host-scoped and page without item/event multiplication',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`CREATE TABLE orders(id text PRIMARY KEY,site text,order_type text,status text,paid_at timestamptz,payment_key text,order_number text,buyer_name text,buyer_phone text,recipient_name text,recipient_phone text,total_amount int,shipping_fee int);
      CREATE TABLE products_shop(id text PRIMARY KEY,expected_ship_date date,return_cost_roundtrip int);
      CREATE TABLE order_items(id text,order_id text,product_id text,product_name text);
      CREATE TABLE order_returns(id text PRIMARY KEY,order_id text,kind text,status text,items json,reason text,detail text,photos json,pickup_address text,pickup_detail text,fee_agreed bool,prev_status text,created_at timestamptz);
      CREATE TABLE order_return_events(return_id text,status text,created_at timestamptz,note text,admin_name text);
      INSERT INTO orders(id,site,order_type,status,paid_at,payment_key) SELECT 'o'||n,'sanjipick','shop','paid','2026-11-01T00:00Z','real' FROM generate_series(1,251) n;
      INSERT INTO orders(id,site,order_type,status,paid_at,payment_key) VALUES ('other','blendpick','shop','paid','2026-11-01T00:00Z','real'),('sim','sanjipick','shop','paid','2026-11-01T00:00Z','SIM_x'),('hotel','sanjipick','hotel','paid','2026-11-01T00:00Z','real');
      INSERT INTO products_shop VALUES ('p','2026-11-04',1000),('q',null,2000);
      INSERT INTO order_items VALUES ('i1','o1','p','예약'),('i2','o1',null,'[추가] 포장'),('i3','o2','p','예약'),('i4','o2','q','일반');
      INSERT INTO order_returns(id,order_id,kind,status,reason,created_at) SELECT 'r'||n,'o'||n,CASE WHEN n%2=0 THEN 'exchange' ELSE 'return' END,'done','단순 변심','2026-10-31T15:00Z' FROM generate_series(1,251) n;
      INSERT INTO order_returns(id,order_id,kind,status,reason,created_at) VALUES ('other-r','other','return','done','기타','2026-10-31T15:00Z'),('sim-r','sim','return','done','기타','2026-10-31T15:00Z'),('outside','o1','return','done','기타','2026-11-01T15:00Z');
      INSERT INTO order_return_events SELECT id,'done','2026-11-02T15:00Z',null,null FROM order_returns WHERE id<>'r251';
      INSERT INTO order_return_events VALUES ('r1','done','2026-11-03T15:00Z',null,null),('r2','collecting','2026-11-01T00:00Z',null,null);`);
    const service=load('lib/admin-insights-db.ts',{'@/lib/db-shop':{query:(sql,p)=>db.query(sql,p)}});
    const queue=await service.getOrderQueueSummary('sanjipick',at);assert.equal(queue.total,251);assert.equal(queue.rows[0].values[4],1);assert.equal(queue.rows[0].values[1],250);
    assert.equal((await service.getOrderQueueSummary('blendpick',at)).total,1);
    const range={from:'2026-11-01',to:'2026-11-01',kind:'all'};
    const summary=await service.getReturnSummary('sanjipick',range);assert.equal(summary.total,251);assert.equal(summary.medianHours,48);assert.equal(summary.durations.at(-1).count,1);
    const pages=await Promise.all([1,2,3,4,5,6].map(p=>service.getReturnPage('sanjipick',range,p)));
    assert.equal(pages[0].total,251);assert.equal(new Set(pages.flatMap(p=>p.rows.map(r=>r.id))).size,251);assert.equal(pages[5].rows.length,1);assert(!('total_count' in pages[0].rows[0]));
    assert.equal((await service.getReturnPage('sanjipick',range,7)).total,251);
    const unknown=await service.getReturnPage('sanjipick',{...range,status:'done',duration:'unknown'},1);assert.deepEqual(unknown.rows.map(r=>r.id),['r251']);
    const duration=await service.getReturnPage('sanjipick',{...range,duration:'day3',status:'done'},1);assert.equal(duration.total,250);
    assert.equal((await service.getReturnSummary('blendpick',range)).total,1);
  } finally {await db.close();}
});

test('analysis API authenticates first, rejects invalid filters and ignores client site selection',async()=>{
  function setup(auth=true){
    const calls=[];
    const route=load('app/api/admin/returns/route.ts',{
      'next/headers':{cookies:async()=>({get:()=>auth?{value:'isolated'}:undefined})},
      '@/lib/auth':{verifyAdminToken:async()=>({name:'test'})},
      '@/lib/admin-site':{currentAdminSite:async()=>{calls.push('site');return{key:'sanjipick'};}},
      '@/lib/db-shop':{query:()=>{throw Error('unexpected legacy query');}},
      '@/lib/api-errors':{withApiErrors:(_name,fn)=>fn},
      '@/lib/refund-operation':{},'@/lib/sms':{},'@/lib/return-notify':{},
      '@/lib/admin-insights-db':{getReturnPage:async(...args)=>{calls.push(args);return{rows:[],total:0,page:args[2],pageSize:50};}},
    });return{GET:route.GET,calls};
  }
  const unauth=setup(false);assert.equal((await unauth.GET(new Request('https://example.test/api/admin/returns?page=1'))).status,401);assert.deepEqual(unauth.calls,[]);
  for(const query of ['page=0','page=1&from=2026-02-30','page=1&reason=bad','page=1&duration=day1&status=requested','page=1&kind=bad']){
    const f=setup();assert.equal((await f.GET(new Request('https://example.test/api/admin/returns?'+query))).status,400);assert.deepEqual(f.calls,['site']);
  }
  const f=setup();const res=await f.GET(new Request('https://example.test/api/admin/returns?page=2&site=blendpick&kind=return&from=2026-11-01&to=2026-11-03&reason=change'));
  assert.equal(res.status,200);assert.deepEqual(f.calls[1],['sanjipick',{from:'2026-11-01',to:'2026-11-03',kind:'return',reason:'change'},2]);
});
test('historical completed requests are read-only and analysis controls survive empty/loading states',()=>{
  const row={id:'r',order_id:'o',order_number:'주문1',kind:'return',status:'done',items:[],photos:[],reason:'기타',created_kst:'2026/11/01 12:00',buyer_name:'고객',buyer_phone:'01012341234',events:[]};
  const filter={from:'2026-11-01',to:'2026-11-03',kind:'all'};
  function render(rows,loading=false){
    const states=[1,rows.length,undefined,'all',rows,loading,'',null];let i=0;
    const Panel=load('components/admin/ReturnsPanel.tsx',{
      react:{...React,useState:()=>[states[i++],()=>{}],useCallback:fn=>fn,useEffect:()=>{}},
      'next/link':({prefetch,children,...p})=>React.createElement('a',p,children),
      '@/lib/api-error-message':{},
    }).default;
    return renderToStaticMarkup(React.createElement(Panel,{kind:'all',analysisFilter:filter}));
  }
  const html=render([row]);assert.match(html,/완료/);assert.doesNotMatch(html,/반품 완료 · 환불|수거·처리 시작|>거절</);assert.match(html,/조건 해제/);
  assert.match(render([]),/조건 해제/);assert.match(render([],true),/조건 해제/);
});
