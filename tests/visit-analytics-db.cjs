const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {load}=require('./support/load.cjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const input=(event,visitor=1,page='home')=>({eventId:id(event),visitorId:id(visitor),page});
const at=m=>new Date(Date.parse('2026-09-08T01:00:00Z')+m*60000);
process.env.ANALYTICS_ENABLED='true';process.env.ANALYTICS_HASH_SECRET='test-only-analytics-key-32-characters-minimum';
test('격리 PostgreSQL 방문 수집·집계',async t=>{const db=new PGlite();let releases=0;
 const pool={connect:async()=>({query:(...args)=>db.query(...args),release:()=>releases++})};
 const store=load('lib/visit-analytics/store.ts',{'@/lib/visit-analytics/db':{analyticsConfigured:()=>true,analyticsPool:()=>pool}});
 const clear=()=>db.exec('TRUNCATE analytics_pageviews,analytics_sessions');
 try{
 await t.test('마이그레이션 두 번 실행 가능',async()=>{const sql=fs.readFileSync(path.join(__dirname,'../ops/sql/visit-analytics.sql'),'utf8');await db.exec(sql);await db.exec(sql)});
 await t.test('1명·1세션·3페이지 집계',async()=>{await clear();for(let i=0;i<3;i++)await store.recordPageview('blendpick',input(i+10,1,['home','product','cart'][i]),at(i));const r=await store.getVisitSummary('blendpick',7,at(3));assert.deepEqual(r.totals,{pageviews:3,visitors:1,sessions:1});assert.equal(r.pages.length,3);assert.equal(r.daily[0].day,'2026-09-08')});
 await t.test('같은 이벤트 재전송은 세션도 늘리지 않음',async()=>{assert.equal(await store.recordPageview('blendpick',input(10),at(40)),'duplicate');const r=await store.getVisitSummary('blendpick',7,at(41));assert.equal(r.totals.pageviews,3);assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM analytics_sessions')).rows[0].n,1)});
 await t.test('30분 미만 유지·정확히 30분 새 세션',async()=>{await clear();await store.recordPageview('blendpick',input(20),at(0));await store.recordPageview('blendpick',input(21),at(29));await store.recordPageview('blendpick',input(22),at(59));const r=await store.getVisitSummary('blendpick',7,at(60));assert.equal(r.totals.sessions,2);assert.equal(r.totals.visitors,1)});
 await t.test('동일 이벤트·방문자 ID도 사이트별 분리',async()=>{await store.recordPageview('sanjipick',input(20),at(0));const r=await store.getVisitSummary('sanjipick',7,at(60));assert.deepEqual(r.totals,{pageviews:1,visitors:1,sessions:1});assert.notEqual(store.visitorHash('blendpick',id(1)),store.visitorHash('sanjipick',id(1)))});
 await t.test('잘못된 page 삽입은 세션까지 롤백·연결 반환',async()=>{const before=(await db.query('SELECT COUNT(*)::int AS n FROM analytics_sessions')).rows[0].n;const r=releases;await assert.rejects(store.recordPageview('blendpick',input(30,99,'bad'),at(61)));assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM analytics_sessions')).rows[0].n,before);assert.equal(releases,r+1)});
 await t.test('분당 60건 상한·중복 재전송은 상한 미소비',async()=>{await clear();for(let i=0;i<60;i++)assert.equal(await store.recordPageview('blendpick',input(100+i),at(0)),'recorded');assert.equal(await store.recordPageview('blendpick',input(100),at(0)),'duplicate');assert.equal(await store.recordPageview('blendpick',input(999),at(0)),'limited');assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM analytics_pageviews')).rows[0].n,60)});
 await t.test('조회 실패를 정상0으로 바꾸지 않음·수집 중지는 DB 미사용',async()=>{process.env.ANALYTICS_ENABLED='false';const before=releases;assert.equal((await store.getVisitSummary('blendpick',7,at(1))).state,'disabled');assert.equal(releases,before);process.env.ANALYTICS_ENABLED='true';const fail=load('lib/visit-analytics/store.ts',{'@/lib/visit-analytics/db':{analyticsConfigured:()=>true,analyticsPool:()=>({connect:async()=>{throw Error('offline')}})}});await assert.rejects(fail.getVisitSummary('blendpick',7),/offline/)});
 await t.test('기간 합계는 일별 방문자 단순 합산이 아님',async()=>{await clear();await store.recordPageview('blendpick',input(300),new Date('2026-09-07T01:00:00Z'));await store.recordPageview('blendpick',input(301),at(0));const r=await store.getVisitSummary('blendpick',7,at(1));assert.equal(r.totals.visitors,1);assert.equal(r.daily.reduce((n,x)=>n+x.visitors,0),2);assert.equal(r.totals.sessions,2)});
 }finally{await db.close();}
});
