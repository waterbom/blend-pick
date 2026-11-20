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
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),fs=require('node:fs'),path=require('node:path');
 const {DangungHero,DangungIntro,DangungStory,DangungGuide,DangungClosing}=load('components/dangung/Landing.tsx',{'@/components/dangung/Notice':()=>null});
 const html=[DangungHero,DangungIntro,DangungStory,DangungGuide,DangungClosing].map(Component=>renderToStaticMarkup(React.createElement(Component))).join('');
 const src=[...html.matchAll(/ src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(src).size,22);
 // 사진의 src 는 항상 받은 원본(jpg)이다. 화면 크기별 경량본은 srcset 으로만 쓰고, 파일이 모두 있어야 한다.
 assert.ok(src.every(file=>/^\/hotel\/dangung\/photo-\d{2}\.jpg$/.test(file)));
 const sets=[...html.matchAll(/ src="(\/hotel\/dangung\/photo-(\d{2})\.jpg)" srcSet="([^"]+)"/g)];
 assert.equal(sets.length,src.length,'every photo offers lighter versions');
 for(const [,file,id,set] of sets)assert.match(set,new RegExp(`^/hotel/dangung/photo-${id}-720\\.webp 720w, /hotel/dangung/photo-${id}-1200\\.webp 1200w, ${file.replace('.','\\.')} \\d+w$`));
 const dir=path.join(__dirname,'../public/hotel/dangung');
 for(let id=1;id<=22;id++){
  const base=path.join(dir,`photo-${String(id).padStart(2,'0')}`),original=fs.statSync(base+'.jpg').size;
  for(const width of [240,720,1200])assert.ok(fs.statSync(`${base}-${width}.webp`).size<original,`photo ${id} ${width}w is lighter than the original`);
 }
 assert.match(html,/침구류는 매일 세탁/);assert.match(html,/단궁 직원이 직접 청소/);
 assert.doesNotMatch(html,/파티룸|DRAFT|전달 예정|초안 검토|제시가/);
 // 구간과 바로가기: 메뉴가 가리키는 곳과 예약 안내의 세부 항목이 모두 있다
 for(const id of ['stay-story','four-seasons','materials','highlights','rooms','food','bbq','cafe','location','stay','memory','blog'])assert.ok(html.includes(`id="${id}"`),id);
 // 네 계절과 단궁을 이루는 재료 — 재료는 받은 사진의 한 부분을 가까이 본 것이다
 assert.equal((html.match(/<figure class="dgs-season">/g)||[]).length,4);
 const materials=[...html.matchAll(/<figure class="dgs-material"><button type="button" data-photo="(\d+)"[^>]*style="--x:\d+%;--y:\d+%;--zoom:[\d.]+"/g)].map(m=>Number(m[1]));
 assert.deepEqual(materials,[3,17,16,6]);
 for(const text of ['기와','나무','돌','잔디','단궁을 이루는 것들','네 계절, 네 가지 단궁'])assert.ok(html.includes(text),text);
});
test('the stay page keeps photographs as they are: no cropping in the body, no decoration or new motion',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const css=fs.readFileSync(path.join(__dirname,'../components/dangung/stay.css'),'utf8');
 // 본문 사진은 원래 비율 그대로 (가로 폭에 맞추고 높이는 자동) — 비율을 강제하거나 잘라내지 않는다
 assert.match(css,/\.dg-stay-page \.dgs-photo img \{ display: block; width: 100%; height: auto; \}/);
 assert.doesNotMatch(css,/\.dgs-photo[^{]*img[^{]*\{[^}]*(aspect-ratio|object-fit)/);
 // 한지색 바탕과 먹색 글자, 그림자·키프레임 애니메이션 없음
 assert.match(css,/--paper: #f5f2ea;/);assert.match(css,/--ink: #23261f;/);
 assert.doesNotMatch(css,/@keyframes/);assert.doesNotMatch(css.replace(/box-shadow: none/g,''),/box-shadow/);
 // 마우스 오버 표시는 마우스 환경에서만 (터치에서는 누른 뒤에도 남는다)
 for(const line of css.split('\n'))if(/:hover/.test(line))assert.ok(/@media \(hover: hover\)/.test(line),line.slice(0,90));
 const page=fs.readFileSync(path.join(__dirname,'../app/hotel/dangung/page.tsx'),'utf8');
 assert.match(page,/data-dangung-version="2026-11-nature-1"/);assert.match(page,/<DangungIntro\/>/);assert.match(page,/<DangungClosing\/>/);
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
