const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./support/load.cjs');
const api=load('lib/api-errors.ts');
const {withApiErrors,ApiError,readJsonObject,apiErrorResponse,rollbackSafely}=api;
const req=(body,headers={})=>new Request('https://shop.blendpunch.com/api/test',{method:'POST',headers:{'content-type':'application/json',...headers},body});
function logs(t){const lines=[];t.mock.method(console,'error',line=>lines.push(line));t.mock.method(console,'warn',line=>lines.push(line));return lines;}

test('an unexpected failure has one trace ID and never leaks SQL, credentials, phone or payload',async t=>{
 const lines=logs(t),secret='PAYMENT_KEY_SECRET 010-1234-5678 postgres://admin:secret@db';let calls=0;
 const handler=withApiErrors('POST /api/test',async()=>{calls++;const e=new Error(secret);e.detail=secret;throw e;});
 const response=await handler(req(JSON.stringify({secret}),{'x-request-id':secret}));const body=await response.json();
 assert.equal(response.status,500);assert.equal(calls,1);assert.equal(body.retryable,false);
 assert.equal(body.code,'INTERNAL_ERROR');assert.match(body.requestId,/^[a-f0-9-]{36}$/);assert.equal(response.headers.get('x-request-id'),body.requestId);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.match(body.error,/문의번호/);
 assert.ok(!JSON.stringify([body,...lines]).includes(secret));assert.ok(lines.some(line=>JSON.parse(line).requestId===body.requestId));
});
for(const [source,expected,status] of [['22P02','INVALID_INPUT',400],['23505','DUPLICATE_DATA',409],['23503','RELATED_DATA',409],['P2001','REFUND_IN_PROGRESS',409],['40P01','DB_BUSY',503],['42703','DB_SCHEMA_MISMATCH',503],['42883','DB_SCHEMA_MISMATCH',503],['42804','DB_SCHEMA_MISMATCH',503],['53300','DB_UNAVAILABLE',503],['ETIMEDOUT','UPSTREAM_TIMEOUT',504]]){
 test('database/network failure '+source+' provides a safe cause and actionable response',async t=>{
  const lines=logs(t);const response=await withApiErrors('POST /api/test',async()=>{throw Object.assign(new Error('private SQL data'),{code:source,detail:'personal address'});})();
  const body=await response.json();assert.equal(response.status,status);assert.equal(body.code,expected);assert.ok(body.action);assert.ok(lines.some(l=>JSON.parse(l).sourceCode===source));assert.doesNotMatch(JSON.stringify([body,...lines]),/private SQL|personal address/);
 });
}
for(const [value,code] of [['{','INVALID_JSON'],['null','INVALID_BODY'],['[]','INVALID_BODY'],['"hello"','INVALID_BODY'],['1','INVALID_BODY'],['','INVALID_JSON']]){
 test('malformed request '+value+' is rejected before side effects',async t=>{logs(t);let writes=0;const response=await withApiErrors('POST /api/test',async request=>{await readJsonObject(request);writes++;return Response.json({ok:true});})(req(value));assert.equal(response.status,400);assert.equal((await response.json()).code,code);assert.equal(writes,0);});
}
test('body byte limit is enforced even without content-length',async t=>{
 logs(t);for(const headers of [{},{'content-length':'100000'}]){const response=await withApiErrors('POST /api/test',async r=>{await readJsonObject(r,32);return Response.json({ok:true});})(req(JSON.stringify({a:'가'.repeat(30)}),headers));assert.equal(response.status,413);assert.equal((await response.json()).code,'REQUEST_TOO_LARGE');}
});
test('successful cookies, downloads and redirects keep the exact response and body',async()=>{
 for(const response of [Response.json({ok:true},{headers:{'set-cookie':'test=1; HttpOnly'}}),new Response('xlsx',{headers:{'content-type':'application/octet-stream'}}),Response.redirect('https://shop.blendpunch.com/',302),new Response(null,{status:204})]){
  assert.equal(await withApiErrors('GET /api/test',async()=>response)(),response);assert.equal(response.bodyUsed,false);
 }
});
test('Next redirect and not-found control flow are not converted into 500s',async()=>{
 for(const digest of ['NEXT_REDIRECT;replace;/login;307;','NEXT_HTTP_ERROR_FALLBACK;404','DYNAMIC_SERVER_USAGE']){const e=Object.assign(new Error('framework'),{digest});await assert.rejects(withApiErrors('GET /api/test',async()=>{throw e;}),error=>error===e);}
});
test('partial completion keeps counts and HTTP contract without automatic replay',async t=>{
 logs(t);let calls=0;const response=await withApiErrors('PATCH /api/admin/orders',async()=>{calls++;return Response.json({ok:false,updated:2,failed:1,error:'환불 실패 1건'});})();const body=await response.json();assert.equal(response.status,200);assert.equal(body.updated,2);assert.equal(body.failed,1);assert.equal(body.code,'PARTIAL_FAILURE');assert.equal(calls,1);
});
test('concurrent requests keep separate request IDs and operation context',async t=>{
 const lines=logs(t);const run=op=>withApiErrors(op,async()=>{await new Promise(r=>setTimeout(r,op.endsWith('a')?15:1));return apiErrorResponse(new ApiError('DB_UNAVAILABLE'));})();
 const bodies=await Promise.all((await Promise.all([run('POST /api/a'),run('GET /api/b')])).map(r=>r.json()));assert.notEqual(bodies[0].requestId,bodies[1].requestId);
 assert.ok(lines.some(l=>JSON.parse(l).operation==='POST /api/a'&&JSON.parse(l).requestId===bodies[0].requestId));assert.ok(lines.some(l=>JSON.parse(l).operation==='GET /api/b'&&JSON.parse(l).requestId===bodies[1].requestId));
});
test('rollback failure reports uncertainty but does not replace the original error',async t=>{
 logs(t);let released=false;const response=await withApiErrors('POST /api/test',async()=>{try{throw Object.assign(new Error('primary failure'),{code:'23505'});}catch(error){assert.equal(await rollbackSafely({query:async()=>{throw new Error('rollback lost');}}),false);throw error;}finally{released=true;}})();assert.equal(released,true);assert.equal((await response.json()).code,'DUPLICATE_DATA');
});
test('payment timeout does not invite a fresh approval and is never retried',async t=>{
 logs(t);let approvals=0;const response=await withApiErrors('POST /api/payment/shop-confirm',async()=>{approvals++;throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});})();const body=await response.json();assert.equal(approvals,1);assert.match(body.error,/다시 결제하지 말고/);assert.equal(body.retryable,false);
});
test('real administrator route reports an unexpected schema error without leaking query details',async t=>{
 const lines=logs(t);const route=load('app/api/admin/orders/route.ts',{'next/headers':{cookies:async()=>({get:()=>({value:'mock'})})},'@/lib/auth':{verifyAdminToken:async()=>({})},'@/lib/admin-site':{currentAdminSite:async()=>({key:'blendpick'}),adminOrderIdsBelong:async()=>true},'@/lib/order-cancel':{cancelShopOrder:async()=>{throw Error('must not cancel');}},'@/lib/db-shop':{query:async()=>{throw Object.assign(new Error('customer_private_column'),{code:'42703'});}}});
 const response=await route.GET(new Request('https://shop.blendpunch.com/api/admin/orders'));assert.equal(response.status,503);assert.equal((await response.json()).code,'DB_SCHEMA_MISMATCH');assert.doesNotMatch(lines.join('\n'),/customer_private_column/);
});
test('client formatter retains readable cause and the same support reference',()=>{
 const {apiErrorMessage}=load('lib/api-error-message.ts');const id='00000000-0000-4000-8000-000000000001';const text=apiErrorMessage({error:'상태가 변경되었습니다.',code:'STATE_CONFLICT',requestId:id,action:'목록을 새로고침해주세요.'});assert.match(text,/STATE_CONFLICT/);assert.ok(text.includes(id));assert.match(text,/새로고침/);assert.equal(apiErrorMessage({error:text,code:'STATE_CONFLICT',requestId:id}),text);
});
test('non-JSON server error pages do not appear as raw HTML or JavaScript parse errors',async()=>{
 const {readApiJson}=load('lib/api-error-message.ts');await assert.rejects(readApiJson(new Response('<html>secret diagnostic</html>',{status:502})),e=>/RESPONSE_INVALID/.test(e.message)&&!e.message.includes('secret diagnostic'));
});
test('damaged or blocked checkout storage cannot crash a completed payment screen',t=>{
 const previous=global.sessionStorage;t.after(()=>{if(previous===undefined)delete global.sessionStorage;else global.sessionStorage=previous;});const {readCheckoutSession,clearCheckoutSession}=load('lib/payment-client.ts');
 for(const value of ['{','null','[]','3']){global.sessionStorage={getItem:()=>value};assert.equal(readCheckoutSession('checkoutData'),null);}
 global.sessionStorage={getItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}};assert.equal(readCheckoutSession('checkoutData'),null);assert.doesNotThrow(()=>clearCheckoutSession('checkoutData'));
});
