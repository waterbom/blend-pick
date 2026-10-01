const {test}=require('node:test');const assert=require('node:assert/strict');
const {sendNotice,receipt,configuration}=require('../lib/commerce-provider.cjs');
const {load}=require('./support/load.cjs');
function setup(t){
 for(const [key,value] of Object.entries({COMMERCE_ALIMTALK_ENABLED:'true',SOLAPI_API_KEY:'fixture',SOLAPI_API_SECRET:'fixture-secret',SOLAPI_SENDER:'01000000000',BLENDPICK_SOLAPI_PFID:'PFfixture',BLENDPICK_ALIMTALK_PAID_TEMPLATE:'KAfixture'})){
  const before=process.env[key];process.env[key]=value;t.after(()=>{if(before===undefined)delete process.env[key];else process.env[key]=before;});
 }
}
const job={id:'job',site:'blendpick',kind:'paid',phone:'01000000000',body:'내용',variables:{'#{주문번호}':'ORDER'}};
test('missing config does not call a provider or fall back to an unintended paid channel',async t=>{
 delete process.env.COMMERCE_ALIMTALK_ENABLED;let calls=0;t.mock.method(global,'fetch',async()=>{calls++;});
 assert.equal((await sendNotice(job)).status,'blocked');assert.equal(calls,0);assert.equal(configuration('unknown').paid,false);
});
test('approved template variables, brand profile, HMAC and explicit fallback use official provider shape',async t=>{
 setup(t);t.mock.method(global,'fetch',async(url,options)=>{assert.equal(url,'https://api.solapi.com/messages/v4/send-many/detail');assert.match(options.headers.Authorization,/HMAC-SHA256 apiKey=fixture/);
  const body=JSON.parse(options.body);assert.equal(body.messages[0].kakaoOptions.pfId,'PFfixture');assert.equal(body.messages[0].kakaoOptions.templateId,'KAfixture');assert.deepEqual(body.messages[0].kakaoOptions.variables,job.variables);assert.equal(body.messages[0].kakaoOptions.disableSms,true);
  return Response.json({messageList:[{messageId:'M123',statusCode:'2000'}],failedMessageList:[]});});
 assert.deepEqual(await sendNotice(job),{status:'accepted',providerId:'M123'});assert.equal(configuration('sanjipick').paid,false);
});
for(const mode of ['html','timeout','empty','rejected','http'])test('provider '+mode+' never claims delivery or automatically retries',async t=>{
 setup(t);t.mock.method(global,'fetch',async()=>{if(mode==='timeout')throw Error('secret diagnostics');if(mode==='html')return new Response('<html>private</html>');if(mode==='http')return Response.json({error:'secret'},{status:503});return Response.json(mode==='rejected'?{failedMessageList:[{error:'private'}]}:{});});
 const result=await sendNotice(job);assert.equal(result.status,'review');assert.doesNotMatch(JSON.stringify(result),/private|secret/);
});
test('receipt confirms only 4000 and does not resend a pending replacement',async t=>{
 setup(t);let message={statusCode:'2000',status:'SENDING'};t.mock.method(global,'fetch',async()=>Response.json({messageList:{M123:message}}));
 assert.equal((await receipt('M123')).status,'accepted');message={statusCode:'4000',status:'COMPLETE'};assert.equal((await receipt('M123')).status,'delivered');
 message={statusCode:'3000',status:'COMPLETE'};assert.equal((await receipt('M123')).status,'review');
});
test('Channel membership uses documented hex-decoded HMAC, only verified order and no secrets',async t=>{
 const secret='4629de5def93d6a2abea6afa9bd5476d9c6cbc04223f9a2f7e517b535dde3e25';
 process.env.BLENDPICK_CHANNEL_PLUGIN_KEY='plugin-fixture';process.env.BLENDPICK_CHANNEL_MEMBER_HASH_SECRET=secret;t.after(()=>{delete process.env.BLENDPICK_CHANNEL_PLUGIN_KEY;delete process.env.BLENDPICK_CHANNEL_MEMBER_HASH_SECRET;});
 let orders=0;const api=load('app/api/customer/channel/route.ts',{'@/lib/customer-access':{customerAccess:async()=>({id:'buyer',site:'blendpick'}),ownedOrder:async(id)=>{assert.equal(id,'owned');orders++;return {order_number:'ORDER',status:'paid'};}}});
 const response=await api.GET(new Request('https://shop.blendpunch.com/api/customer/channel?order=owned'));const body=await response.json();assert.equal(orders,1);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(body.memberHash,require('node:crypto').createHmac('sha256',Buffer.from(secret,'hex')).update('blendpick:buyer').digest('hex'));assert.doesNotMatch(JSON.stringify(body),new RegExp(secret));assert.equal(body.profile.orderNumber,'ORDER');
});
test('HACCP non-JSON or service errors are explicit; secrets do not leave the server',async t=>{
 process.env.HACCP_SERVICE_KEY='private-haccp-key';t.after(()=>delete process.env.HACCP_SERVICE_KEY);
 const api=load('app/api/admin/haccp/route.ts',{'@/lib/customer-access':{adminAccess:async()=> 'sanjipick',inputText:v=>v}});
 t.mock.method(global,'fetch',async()=>new Response('<html>bad gateway</html>',{status:200}));
 const response=await api.GET(new Request('https://sanjipick.blendpunch.com/api/admin/haccp?number=2025-1-1234'));assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-haccp-key|bad gateway/);
});
