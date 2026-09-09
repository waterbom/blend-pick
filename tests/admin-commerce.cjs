const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./support/load.cjs');
const {adminGroups,adminLocation}=load('lib/admin-navigation.ts');
test('every navigation destination exists and Sanji excludes reservations',()=>{
 for(const site of ['blendpick','sanjipick'])for(const g of adminGroups(site))for(const item of g.items){assert(fs.existsSync(`app/admin/(protected)${item.href.slice(6)}/page.tsx`),item.href);}
 assert(!adminGroups('sanjipick').flatMap(g=>g.items).some(i=>i.href.includes('reservations')));
 assert.equal(adminGroups('blendpick').length,7);
});
test('nested routes resolve to most specific menu and avoid prefix collisions',()=>{
 assert.equal(adminLocation('/admin/products/new','sanjipick').label,'상품 등록');
 assert.equal(adminLocation('/admin/products/abc','sanjipick').label,'상품 조회·수정');
 assert.equal(adminLocation('/admin/orders/abc','blendpick').group,'주문·배송');
 assert.equal(adminLocation('/admin/products-other','blendpick').label,'관리자');
});
test('channel links allow only Kakao channel paths with no embedded credentials',()=>{
 const {kakaoChannelUrl}=load('lib/kakao-commerce.ts');
 assert.equal(kakaoChannelUrl('http://pf.kakao.com/_test/chat'),'https://pf.kakao.com/_test/chat');
 for(const x of ['javascript:alert(1)','https://evil.test/_abc/chat','https://pf.kakao.com.evil.test/_abc/chat','https://secret@pf.kakao.com/_abc/chat','https://pf.kakao.com:444/_abc/chat'])assert.equal(kakaoChannelUrl(x),null);
});
test('notification page is inherited from protected layout and preview includes no send endpoint',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');
 const Panel=load('components/admin/KakaoCommercePanel.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Panel,{siteName:'산지픽',channelUrl:null,sharedChannel:false}));
 assert(html.includes('자동 발송 준비 전'));assert(html.includes('문안 복사'));assert(!html.includes('설정된 상담 채널 열기'));
 assert(fs.readFileSync('app/admin/(protected)/layout.tsx','utf8').includes('verifyAdminToken'));
});

test('Sanji labels retain commerce partners while removing hotel menus and active paths',()=>{
 const groups=adminGroups('sanjipick'),items=groups.flatMap(g=>g.items);
 assert(items.some(i=>i.label==='농가 출고·배송'));assert(items.some(i=>i.label==='공구 파트너 정산'));
 assert(!JSON.stringify(groups).includes('숙박'));assert(!JSON.stringify(groups).includes('reservations'));
 assert.equal(adminLocation('/admin/reservations','sanjipick').href,'/admin');
 assert.equal(adminLocation('/admin/reservations','blendpick').label,'숙박 예약');
});
test('Sanji hotel pages and APIs remain blocked even with admin cookie and spoofed site',()=>{
 const {NextRequest}=require('next/server'),{proxy}=load('proxy.ts');
 for(const path of ['/admin/reservations','/admin/reservations/example','/api/admin/reservations','/api/admin/reservations/notify','/api/admin/reservations/change-date','/api/admin/reservations/inventory','/api/admin/reservations/delivery','/api/admin/hotel-worksheet']){
  const request=new NextRequest('https://sanjipick.blendpunch.com'+path+'?site=blendpick',{headers:{host:'sanjipick.blendpunch.com',cookie:'admin_token=fixture; sj_preview=1','x-site':'blendpick'}});
  assert.equal(proxy(request).status,404,path);
 }
 const own=proxy(new NextRequest('https://sanjipick.blendpunch.com/api/admin/orders',{headers:{host:'sanjipick.blendpunch.com'}}));assert.notEqual(own.status,404);
 const shop=proxy(new NextRequest('https://shop.blendpunch.com/api/admin/reservations',{headers:{host:'shop.blendpunch.com'}}));assert.notEqual(shop.status,404);
});
