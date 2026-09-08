const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepare}=require('../scripts/prepare-visit-analytics.cjs');
test('비활성 방문 통계는 DB 생성/접속 안 함',async()=>{assert.equal(await prepare({},()=>{throw Error('must not connect')}),'disabled')});
test('활성화 설정 누락 시 배포 전 차단',async()=>{await assert.rejects(prepare({ANALYTICS_ENABLED:'true'},()=>{throw Error('must not connect')}),/configuration/)});
test('설정된 전용 DB에만 마이그레이션·연결 종료',async()=>{let ended=false,queries=0;assert.equal(await prepare({ANALYTICS_ENABLED:'true',ANALYTICS_DATABASE_URL:'test-only',ANALYTICS_HASH_SECRET:'x'.repeat(32)},options=>{assert.equal(options.connectionString,'test-only');return {query:async sql=>{queries++;assert.match(sql,/CREATE TABLE IF NOT EXISTS analytics_pageviews/);assert.ok(!sql.includes('orders'));},end:async()=>{ended=true}}}),'enabled');assert.equal(queries,1);assert.equal(ended,true)});
