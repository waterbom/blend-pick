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
export function installPreviewApi(site:()=>SiteKey){
 window.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:String(input),'https://preview.invalid');
  if ((init?.method||'GET').toUpperCase()!=='GET') return Response.json({error:'미리보기에서는 실제 발주·송장 등록·취소·환불·저장을 실행하지 않습니다.'},{status:409});
  const orders=previewOrders(site());
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
