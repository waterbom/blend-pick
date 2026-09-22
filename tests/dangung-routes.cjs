const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./support/load.cjs');
const {BookingError}=require('../lib/dangung-core.cjs');
test('server guards enforce Sanji isolation, origin and verified admin token',async()=>{
 let host='shop.blendpunch.com',token='';const m=load('lib/dangung-server.ts',{'@/lib/db-shop':{},'next/headers':{headers:async()=>new Headers({host}),cookies:async()=>({get:()=>({value:token})})},'@/lib/auth':{verifyAdminToken:async t=>t==='valid'}});
 const req=origin=>new Request('https://shop.blendpunch.com/api/admin/dangung',{method:'POST',headers:origin?{origin}:{}});
 await assert.rejects(m.guard(req('https://evil.example'),false),e=>e.status===403);await assert.rejects(m.guard(req(),false),e=>e.status===403);
 await assert.rejects(m.guard(req('https://shop.blendpunch.com'),true),e=>e.status===401);token='valid';await m.guard(req('https://shop.blendpunch.com'),true);
 host='sanjipick.blendpunch.com';await assert.rejects(m.guard(),e=>e.status===404);
});
test('phone verification is awaited and uses verified cookie; failed auth never reserves',async()=>{
 let valid=false,calls=0;const route=load('app/api/dangung/route.ts',{'@/lib/dangung-server':{bookingService:{reserve:async()=>{calls++;return {id:'test'};}},guard:async()=>{},owner:async()=> 'session',body:r=>r.json(),paymentReady:()=>true,failure:e=>Response.json({error:e.message},{status:e.status||500})},'@/lib/sms':{phoneVerifyOn:()=>true},'@/lib/phone-verify':{isPhoneVerified:async(token,phone)=>{assert.equal(token,'verified-token');assert.equal(phone,'01012345678');return valid;}},'next/headers':{cookies:async()=>({get:name=>{assert.equal(name,'phone_verified');return {value:'verified-token'};}})}});
 const req=()=>new Request('https://shop.blendpunch.com/api/dangung',{method:'POST',body:JSON.stringify({action:'reserve',buyerPhone:'01012345678'})});assert.equal((await route.POST(req())).status,400);assert.equal(calls,0);valid=true;assert.equal((await route.POST(req())).status,200);assert.equal(calls,1);
});
test('missing payment configuration prevents new reservation and admin opening',async()=>{let calls=0;const common={bookingService:{reserve:()=>calls++,settings:()=>calls++},guard:async()=>{},owner:async()=> 'session',body:r=>r.json(),paymentReady:()=>false,failure:e=>Response.json({error:e.message},{status:e.status||500})};const route=load('app/api/dangung/route.ts',{'@/lib/dangung-server':common,'@/lib/sms':{phoneVerifyOn:()=>false},'@/lib/phone-verify':{},'next/headers':{}}),admin=load('app/api/admin/dangung/route.ts',{'@/lib/dangung-server':common});
 assert.equal((await route.POST(new Request('https://shop.blendpunch.com/api/dangung',{method:'POST',body:'{"action":"reserve"}'}))).status,503);assert.equal((await admin.POST(new Request('https://shop.blendpunch.com/api/admin/dangung',{method:'POST',body:'{"action":"settings","config":{"enabled":true}}'}))).status,409);assert.equal(calls,0);
});
test('client response never exposes database errors or secrets',()=>{const m=load('lib/dangung-server.ts',{'@/lib/db-shop':{},'next/headers':{},'@/lib/auth':{}});assert.equal(m.failure(new Error('password=private')).status,503);assert.equal(m.failure(new BookingError('판매 준비 중',409)).status,409);});
test('published stay content retains all 22 photos and care details',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {DangungHero,DangungStory,DangungGuide}=load('components/dangung/Landing.tsx',{'./Availability':{StayRate:()=>null,StayFees:()=>null}});
 const html=[DangungHero,DangungStory,DangungGuide].map(Component=>renderToStaticMarkup(React.createElement(Component))).join('');
 const src=[...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(src.length,22);assert.equal(new Set(src).size,22);
 assert.match(html,/침구류는 매일 세탁/);assert.match(html,/단궁 직원이 직접 청소/);
 assert.doesNotMatch(html,/파티룸|DRAFT|전달 예정|초안 검토|제시가/);
});
test('starting rate excludes lead time, occupied and unavailable nights and respects sales/payment state',()=>{
 const {startingPrice}=load('components/dangung/Availability.tsx');
 const day=(day,price,available=true,occupied=false)=>({day,price,available,occupied});
 const calendar={today:'2026-09-22',config:{enabled:true,minLeadDays:2},paymentReady:true,dates:[day('2026-09-23',100000),day('2026-09-24',200000,true,true),day('2026-09-25',300000,false),day('2026-09-26',550000),day('2026-09-27',450000)]};
 assert.equal(startingPrice(calendar),450000);
 assert.equal(startingPrice({...calendar,config:{...calendar.config,enabled:false}}),null);
 assert.equal(startingPrice({...calendar,paymentReady:false}),null);
 assert.equal(startingPrice({...calendar,dates:[]}),null);
 assert.equal(startingPrice(null),null);
});
