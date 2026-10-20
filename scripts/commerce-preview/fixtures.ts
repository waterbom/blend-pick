import type { Order } from '@/components/admin/OrdersClient';
import type { SiteKey } from '@/lib/sites';
import type { ProductListItem } from '@/lib/admin-product-list';
import type { ProductSales } from '@/lib/product-sales';
import { CORE_CARRIERS } from '@/lib/carriers';
export const previewNow=Date.parse('2026-10-20T06:37:00Z');
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function previewProducts(site:SiteKey):ProductListItem[]{
 const names=site==='sanjipick'?['경북 햇사과 가정용','고창 꿀고구마','완도 활전복','제주 노지 감귤','영암 무화과','국내산 손질 고등어']:['데일리 보온 텀블러','프리미엄 타월 세트','건강한 한 끼 간편식','홈 카페 유리컵','수납 정리함 세트','자연 유래 핸드워시'];
 return names.map((name,i)=>({id:uuid(i+1),name,brand:site==='sanjipick'?'예시 산지':'예시 브랜드',category:site==='sanjipick'?(i===2||i===5?'산지픽 해산물':'산지픽 농산물'):['생활','생활','식품','생활','생활','뷰티'][i],sale_type:i%2?'always':'groupbuy',price:[32900,25900,49900,19900,35900,18900][i],stock:[32,18,3,80,0,45][i],status:i===5?'draft':'active',sale_start_at:i===3?'2026-10-25T00:00:00Z':null,sale_end_at:i===0?'2026-10-27T14:59:00Z':i===2?'2026-10-22T14:59:00Z':null,product_code:`DEMO-${String(i+1).padStart(3,'0')}`,created_at:'2026-10-01T00:00:00Z',main_image:null,link_code:site==='sanjipick'&&i===0?'previewonly':null,link_start_at:'2026-10-01T00:00:00Z',link_end_at:'2026-10-30T00:00:00Z'}));
}
export function previewOrders(site:SiteKey):Order[]{
 const products=previewProducts(site),states=['paid','confirmed','paid','cancel_requested','preparing','preparing','shipped','shipped','delivered','exchange_requested','return_requested','cancelled'];
 return states.map((status,i)=>{const p=products[i%3];return{id:uuid(i+100),order_number:`DEMO-1020-${String(i+1).padStart(3,'0')}`,site,status,order_type:'shop',buyer_name:`예시 고객 ${i+1}`,buyer_phone:'01000000000',recipient_name:`예시 고객 ${i+1}`,recipient_phone:'01000000000',addr_zipcode:'00000',addr_address:i===2?'':'미리보기 예시 주소',addr_detail:null,addr_memo:i===4?'문 앞에 놓아주세요':null,total_amount:Number(p.price),shipping_fee:0,tracking_company:status==='shipped'||status==='delivered'?'04':null,tracking_number:status==='shipped'||status==='delivered'?`0012345678${i}`:null,influencer_name:null,sales_channel:i%3===0?'non_display':'display',link_code:i%3===0?'previewonly':null,created_at:`2026-10-${i>=4?'19':'20'}T0${i%6}:15:30Z`,paid_at:'2026-10-20T00:00:00Z',payment_verified:true,pending_refunds:false,items:[{id:uuid(i+200),product_id:p.id,product_name:p.name,product_code:p.product_code!,option_label:site==='sanjipick'?'가정용 3kg':'기본 구성',unit_price:Number(p.price),quantity:1,supplier_name:'예시 공급사',expected_ship_date:'2026-10-21'}]};});
}
export function previewSales(site:SiteKey):Record<string,ProductSales>{
 return Object.fromEntries(previewProducts(site).map((p,i)=>{const sold=[82,46,29,0,113,0][i],paid=sold+(sold?3:0);return[p.id,{paid,sold,orders:paid,cancelled:sold?2:0,returned:sold?1:0,pending:i===0?1:0,review:i===2?1:0,options:sold?[{key:'basic',label:site==='sanjipick'?'가정용 3kg':'기본 구성',paid,sold,orders:paid,cancelled:2,returned:1,pending:0,review:0}]:[]}];}));
}
export function previewSettlements(site:SiteKey){
 return Array.from({length:65},(_,i)=>({id:uuid(700+i),order_id:uuid(100+i),order_number:`DEMO-SET-${String(i+1).padStart(3,'0')}`,buyer_name:`예시 고객 ${i+1}`,site,
 settled_at:new Date(previewNow-Math.floor(i/5)*86400000).toISOString(),gross_amount:50000+i*1000,fee:1500+i*30,net_amount:i===2?null:48500+i*970,unresolved:i===2,fee_estimated:i%4===0}));
}
function previewMembers(){
 return Array.from({length:8},(_,i)=>({id:uuid(800+i),name:`예시 회원 ${i+1}`,nickname:`미리보기 ${i+1}`,email:`member${i+1}@example.invalid`,role:i<2?'influencer':i===2?'vendor':'customer',role_status:i<2?'pending':null,is_active:i!==4,profile_image:null,via_kakao:i%2===0,joined_at:`2026-10-${String(20-i).padStart(2,'0')}`,joined_estimated:i===7,orders:i%4,spent:i%4*45900,cancels:i===4?1:0,returns:i===3?1:0,last_order_at:i%4?'2026-10-19':null}));
}
const previewPhoto='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="104" height="104"><rect width="104" height="104" fill="#e2e9de"/><circle cx="52" cy="44" r="23" fill="#749261"/><text x="52" y="90" text-anchor="middle" font-size="12" fill="#304c2d">사진 예시</text></svg>');
function previewReviews(site:SiteKey){
 const products=previewProducts(site);
 return [5,4,2,5,1,4].map((rating,i)=>({id:uuid(900+i),product_id:products[i%3].id,product_name:products[i%3].name,product_code:products[i%3].product_code,buyer_name:`예시 작성자 ${i+1}`,rating,content:['포장이 깔끔하고 구성도 마음에 들어요. 다음 공구에도 구매하고 싶어요.','가족과 나누기 좋은 구성이에요.','배송 중 포장이 눌려 도착했어요. 포장 개선을 부탁드려요.','사진처럼 색상과 크기가 마음에 들어요. 잘 쓰겠습니다.','받은 구성에 누락된 상품이 있어 문의했어요.','선물용으로 주문했는데 만족합니다.'][i],images:i%2===0?[previewPhoto]:[],is_hidden:i===4,created_at:`2026-10-${20-i}T02:30:00Z`}));
}
function previewReservations(){
 const states=['paid','paid','cancelled','paid','checked_in','awaiting','paid','no_show'];
 return states.map((status,i)=>({id:uuid(1000+i),order_number:`DEMO-STAY-${String(i+1).padStart(3,'0')}`,status,buyer_name:`예시 예약자 ${i+1}`,buyer_phone:'01000000000',addr_memo:i===0?'요청: 가능하면 조용한 객실로 부탁드려요.':null,
 stay_check_in:`2026-10-${21+i}`,stay_check_out:`2026-10-${22+i}`,total_amount:i===6?580000:198000,extra_paid:i===1?20000:0,influencer_name:i%2?'예시 파트너':null,stay_changed:i===1,repaid_after_cancel:false,created_at:'2026-10-19T00:30:00Z',paid_at_kst:status==='awaiting'?null:'10/19 09:30',cancelled_at_kst:status==='cancelled'?'10/20 10:00':null,product_name:i===6?'단궁 한옥 · 독채':'여수 UTOP 마리나 · 2인 패키지 · 패밀리 트윈',
 hotel_sent_at:[0,5,6].includes(i)?null:'2026-10-19T02:00:00Z',hotel_confirmed_at:[4,7].includes(i)?'2026-10-19T03:00:00Z':null,stay_changed_at:i===1?'2026-10-20T01:00:00Z':null,cancelled_at:status==='cancelled'?'2026-10-20T01:00:00Z':null,hotel_sent_kst:[0,5,6].includes(i)?null:'10/19 11:00',hotel_confirmed_kst:[4,7].includes(i)?'10/19 12:00':null,last_change:i===1?'10/21 → 10/22 투숙일 변경':null}));
}
export function installPreviewApi(site:()=>SiteKey){
 window.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:String(input),'https://preview.invalid');
  if ((init?.method||'GET').toUpperCase()!=='GET') return Response.json({error:'미리보기에서는 실제 발주·송장 등록·취소·환불·저장을 실행하지 않습니다.'},{status:409});
  const orders=previewOrders(site());
  if(url.pathname==='/api/admin/members'){
   const all=previewMembers(),q=(url.searchParams.get('q')||'').toLowerCase(),role=url.searchParams.get('role'),status=url.searchParams.get('status');
   const members=all.filter(m=>(!q||[m.name,m.nickname,m.email].some(v=>v.toLowerCase().includes(q)))&&(!role||role===m.role)&&(status==='inactive'?!m.is_active:status==='active'?m.is_active:true)&&(url.searchParams.get('pending')!=='1'||m.role_status==='pending'));
   return Response.json({members,summary:{total:8,new_month:8,influencers:2,pending:2,buyers30:6}});
  }
  if(url.pathname.startsWith('/api/admin/members/'))return Response.json({orders:[{order_number:'DEMO-1020-001',status:'delivered',order_type:'shop',total_amount:45900,paid_date:'2026-10-19',product_name:previewProducts(site())[0].name,item_count:1}],reviewCount:1});
  if(url.pathname==='/api/admin/reviews')return Response.json(previewReviews(site()));
  if(url.pathname==='/api/admin/reservations')return Response.json(site()==='blendpick'?previewReservations():[]);
  if(url.pathname==='/api/admin/reservations/notify')return Response.json({pending:3});
  if(url.pathname==='/api/admin/reservations/inventory')return Response.json(Array.from({length:31},(_,i)=>['디럭스 더블','패밀리 트윈','단궁 독채','단궁 파티룸'].map((room,j)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,room_type:room,allocated:j>1?1:10,booked:j>1?i%2:i%7,remaining:(j>1?1:10)-(j>1?i%2:i%7)}))).flat());
  if(url.pathname==='/api/admin/orders'){const statuses=url.searchParams.get('status')?.split(',');return Response.json(statuses?orders.filter(o=>statuses.includes(o.status)):orders);}
  if(url.pathname==='/api/admin/dispatches'&&!url.search)return Response.json([0,1,2].map(i=>({id:uuid(i+300),request_key:uuid(i+400),created_at:`2026-10-${20-i}T02:30:00Z`,order_count:3+i})));
  if(url.pathname==='/api/admin/shipments/carriers')return Response.json({carriers:CORE_CARRIERS});
  if(url.pathname==='/api/admin/returns'){
   const kind=url.searchParams.get('kind'),o=orders[kind==='exchange'?9:10],id=uuid(kind==='exchange'?500:501);
   if(url.searchParams.has('id')&&url.searchParams.get('id')!==id)return Response.json([]);
   return Response.json([{id,order_id:o.id,order_number:o.order_number,kind,status:kind==='exchange'?'collecting':'requested',items:o.items.map(i=>({...i,item_id:i.id})),reason:kind==='exchange'?'다른 구성으로 교환 요청':'상품 파손',detail:'검토용 예시 신청입니다.',photos:[],pickup_address:'미리보기 예시 수거지',pickup_detail:'상세 주소 예시',fee_agreed:false,return_cost_roundtrip:6000,created_kst:'10/20 14:30',buyer_name:o.buyer_name,buyer_phone:o.buyer_phone,total_amount:o.total_amount,shipping_fee:0,events:[{status:'requested',note:'예시 신청 접수',admin_name:null,at_kst:'10/20 14:30'}]}]);
  }
  if(url.pathname==='/api/admin/shipments/track'){
   const run={id:uuid(600),site:site(),source:'automatic',status:'partial',started_at:'2026-10-20T00:30:00Z',finished_at:'2026-10-20T00:30:13Z',checked:9,delivered:6,in_transit:2,failed:1,skipped:0,message:'예시 결과 · 송장 1건 확인 필요',results:[{order_id:orders[6].id,order_number:orders[6].order_number,outcome:'failed',message:'예시 오류 · 택배사 송장 정보 확인 필요',code:'PREVIEW'}]};
   return Response.json(url.searchParams.has('run')?{run}:{runs:[run],keyConfigured:true});
  }
  return Response.json({error:'이 기능은 운영 화면에서 사용할 수 있습니다. 미리보기는 예시 데이터만 사용합니다.'},{status:409});
 };
}
