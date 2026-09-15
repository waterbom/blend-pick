const {test}=require('node:test'),assert=require('node:assert/strict');
const {sendSMS}=require('../lib/sms-provider.cjs'),{message}=require('../lib/dangung-notifications.cjs');
test('Dangung confirmation and cancellation use LMS payloads; no external SMS request',async()=>{
 const originalFetch=global.fetch,keys=['SOLAPI_API_KEY','SOLAPI_API_SECRET','SOLAPI_SENDER'],saved=keys.map(k=>process.env[k]);
 keys.forEach((k,i)=>process.env[k]=i===2?'010-0000-0000':'isolated-test-only');
 const reservation={id:'00000000-0000-4000-8000-000000000001',buyer_name:'격리테스트',check_in:'2026-10-01',check_out:'2026-10-03',guests:8,amount:1040000,refund_amount:728000,quote:{infants:1,selectedOptions:{bbq:true,monitor:true},bbq:50000,monitor:50000,depositAmount:100000,depositPaymentNote:'계좌 추후 안내'}};
 const calls=[];global.fetch=async(url,options)=>{assert.equal(url,'https://api.solapi.com/messages/v4/send');calls.push(JSON.parse(options.body).message);return {ok:true,json:async()=>({statusCode:'2000'})};};
 try{
 assert.equal((await sendSMS('010-1234-5678',message(reservation,'confirmed'),'단궁 예약 확정')).ok,true);
 assert.equal((await sendSMS('010-1234-5678',message(reservation,'cancelled'),'단궁 예약 취소')).ok,true);
 assert.equal(calls.length,2);for(const c of calls){assert.equal(c.type,'LMS');assert.equal(c.to,'01012345678');assert.ok(c.text.includes(reservation.id));assert.ok(c.text.includes('/hotel/dangung/result'));assert.ok(!c.text.includes('01012345678'));}
 assert.match(calls[0].text,/시설 보증금: 100,000원/);assert.match(calls[1].text,/환불 처리금액: 728,000원/);
 global.fetch=async()=>({ok:false,status:429,json:async()=>({})});assert.equal((await sendSMS('01012345678','test','test')).outcome,'rejected');
 global.fetch=async()=>{throw Error('ambiguous timeout');};assert.equal((await sendSMS('01012345678','test','test')).outcome,'unknown');
 }finally{global.fetch=originalFetch;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
