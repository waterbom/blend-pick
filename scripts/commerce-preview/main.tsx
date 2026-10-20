import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminWorkspaceHeader from '@/components/admin/AdminWorkspaceHeader';
import AdminDashboardView from '@/components/admin/AdminDashboardView';
import OrdersClient from '@/components/admin/OrdersClient';
import ShippingFlowClient from '@/components/admin/ShippingFlowClient';
import ProductsListView from '@/components/admin/ProductsListView';
import SettlementsListView from '@/components/admin/SettlementsListView';
import MembersClient from '@/components/admin/MembersClient';
import ReviewsClient from '@/components/admin/ReviewsClient';
import ReservationsClient from '@/components/admin/ReservationsClient';
import {SiteProvider} from '@/components/SiteContext';
import {previewProducts,previewSales,previewSettlements,previewNow,installPreviewApi} from './fixtures';
import type {SalesSummary} from '@/lib/sales-statistics';
import type {VisitSummary} from '@/lib/visit-analytics/rules';
import type {WorkGroup} from '@/lib/operations';
import type {SiteKey} from '@/lib/sites';
import {usePathname,useSearchParams,navigate} from './navigation';
// The review file has no production connections or mutation endpoints.
let previewSite:SiteKey='blendpick';
installPreviewApi(()=>previewSite);
function sampleWork(empty:boolean):WorkGroup[]{
 return [
  ['cancellations','취소 요청 · 출고 중지 확인',2,'PREVIEW-1020-011','공급사 출고 중지 또는 회수 확인 대기','/admin/shipments#flow-cancel_requested','취소 요청 확인'],
  ['payment-recovery','결제 상태 확인·복구',1,'PREVIEW-1020-024','결제 승인 결과 대조 필요','/admin/payment-recovery','결제 복구 확인'],
  ['tracking','배송 중 · 송장 정보 누락',1,'PREVIEW-1019-038','택배사 정보 누락','/admin/orders/preview#tracking','누락 송장 입력'],
  ['returns','새 교환·반품 신청',2,'PREVIEW-1020-019','반품 접수 · 상품 상태 확인','/admin/shipments?tab=return_requested','반품 신청 검토'],
  ['stock','잔여 재고 5개 이하',1,'제철 사과 3kg','본품 잔여 3개','/admin/products/preview','재고·판매 상태 확인'],
  ['unshipped','결제 후 3일 이상 미출고',1,'PREVIEW-1017-008','배송 준비 · 예약 출고일 확인 필요','/admin/orders/preview','주문·출고 확인'],
 ].map(([key,title,total,label,detail,href,actionLabel],index)=>({key:String(key),title:String(title),total:empty?0:Number(total),explanation:'미리보기 예시 항목',steps:[],resolvedWhen:'처리 후 목록에서 제외',sortLabel:'우선 확인 순',items:empty?[]:Array.from({length:Number(total)},(_,i)=>({id:`${key}-${i}`,label:String(label)+(i?' 외 1건':''),detail:String(detail),href:String(href),elapsed:index<2?'최근 확인 10/20 15:30 KST':'확인 시점 기준 예시',priority:index<3?'first' as const:'today' as const,nextAction:String(actionLabel),actionLabel:String(actionLabel)}))}));
}
function Summary({site}:{site:SiteKey}){
 const query=useSearchParams(),days=['1','7','30'].includes(query.get('days')||'')?Number(query.get('days')):7;
 const [mode,setMode]=useState('normal'),empty=mode==='empty',error=mode==='error';
 const daily=Array.from({length:days},(_,i)=>{const day=new Date(Date.UTC(2026,9,20-(days-1)+i)).toISOString().slice(0,10);const gross=empty?0:[1260000,1870000,1550000,2160000,2980000,2420000,3240000][i%7],refunds=empty?0:i%3===0?65000:0;return {label:day,gross,refunds,net:gross-refunds,orders:empty?0:24+i%7*5,unresolved:0};});
 const totals=daily.reduce((a,d)=>({...a,gross:a.gross+d.gross,refunds:a.refunds+d.refunds,net:a.net+d.net,orders:a.orders+d.orders}),{label:'합계',gross:0,refunds:0,net:0,orders:0,unresolved:0});
 const display={label:'전시',gross:Math.round(totals.gross*.7),refunds:Math.round(totals.refunds*.7),net:Math.round(totals.net*.7),orders:Math.round(totals.orders*.7),unresolved:0};
 const sales:SalesSummary={days,from:daily[0].label,to:daily.at(-1)!.label,daily,totals,channels:[display,{label:'비전시',gross:totals.gross-display.gross,refunds:totals.refunds-display.refunds,net:totals.net-display.net,orders:totals.orders-display.orders,unresolved:0}]};
 const visitDaily=empty?[]:daily.map((d,i)=>({day:d.label,visitors:190+i%7*38,sessions:235+i%7*42,pageviews:540+i%7*113}));
 const visits:VisitSummary={site,days,state:error?'error':empty?'empty':'active',from:daily[0].label+'T00:00:00+09:00',to:'2026-10-20T15:37:00+09:00',lastEventAt:empty||error?null:'2026-10-20T15:36:00+09:00',totals:error?null:{visitors:empty?0:Math.round(visitDaily.reduce((n,d)=>n+d.visitors,0)*(days===1?1:.8)),sessions:visitDaily.reduce((n,d)=>n+d.sessions,0),pageviews:visitDaily.reduce((n,d)=>n+d.pageviews,0)},daily:visitDaily,pages:empty||error?[]:[{page:'home',views:Math.round(visitDaily.reduce((n,d)=>n+d.pageviews,0)*.45)},{page:'product',views:Math.round(visitDaily.reduce((n,d)=>n+d.pageviews,0)*.35)},{page:'catalog',views:Math.floor(visitDaily.reduce((n,d)=>n+d.pageviews,0)*.2)}]};
 return <><label className="preview-state">표시 상태 확인 <select aria-label="예시 데이터 상태" value={mode} onChange={e=>setMode(e.target.value)}><option value="normal">업무가 있는 예시</option><option value="empty">업무·기록 없음</option><option value="error">조회 실패</option></select></label><AdminDashboardView siteKey={site} siteName={site==='sanjipick'?'산지픽':'블랜드픽'} date="2026년 10월 20일 (화) 오후 03:37" sales={error?null:sales} visits={visits} workGroups={error?[]:sampleWork(empty)} workUnavailable={error?['주문·재고 업무','자동 처리 확인']:[]} stats={error?null:{liveGongu:empty?0:8,upcoming:empty?0:3,newOrders:empty?0:12,preparingOrders:empty?0:24,shippedOrders:empty?0:37,todaySettlement:empty?0:1840000}}/></>;
}
function ProductPreview({site}:{site:SiteKey}){
 const params=useSearchParams(),filters=Object.fromEntries(params.entries());
 return <ProductsListView all={previewProducts(site)} now={previewNow} filters={filters} sales={previewSales(site)} salesError="" site={site}/>;
}
function SettlementPreview({site}:{site:SiteKey}){
 const params=useSearchParams();
 return <SettlementsListView all={previewSettlements(site)} filters={Object.fromEntries(params.entries())} now={new Date(previewNow).toISOString()}/>;
}
function ShippingPreview(){
 const query=useSearchParams(),tab=query.get('tab');
 return <ShippingFlowClient initialTab={tab==='exchange_requested'||tab==='return_requested'?tab:undefined} initialRequestId={query.get('requestId')||undefined}/>;
}
function App(){
 const [site,setSite]=useState<SiteKey>('blendpick'),path=usePathname();
 return <SiteProvider site={site}><div onSubmit={e=>{e.preventDefault();const form=e.target as HTMLFormElement;if(['/admin/products','/admin/settlements'].includes(form.getAttribute('action')||'')){const params=new URLSearchParams();new FormData(form).forEach((v,k)=>{if(String(v))params.set(k,String(v));});navigate(form.getAttribute('action')+'?'+params);}}} onClick={e=>{const a=(e.target as HTMLElement).closest('a'),href=a?.getAttribute('href');if(href==='/'||href?.startsWith('/admin')||href?.startsWith('#flow-')||href==='#customer-requests'){e.preventDefault();if(href!=='/')navigate(href);}else if(href?.startsWith('/products')||href?.startsWith('https://')){e.preventDefault();alert('미리보기에서는 실제 상품 페이지로 이동하지 않습니다.');}}}>
  <div className="preview-banner"><strong>관리자 개편 미리보기</strong><span>모든 수치는 예시 · 실제 발주/환불/저장 불가 · 운영 반영 전</span><select aria-label="미리보기 사이트" value={site} onChange={e=>{previewSite=e.target.value as SiteKey;setSite(previewSite);navigate('/admin');}}><option value="blendpick">블랜드픽</option><option value="sanjipick">산지픽</option></select><nav className="preview-page-links" aria-label="미리보기 화면">{[['/admin','운영 홈'],['/admin/orders','주문 관리'],['/admin/shipments','배송·반품'],['/admin/products','상품 관리'],['/admin/settlements','매출·정산'],['/admin/members','회원 관리'],['/admin/reviews','리뷰 관리'],...(site==='blendpick'?[['/admin/reservations','숙박 예약']]:[])].map(([href,label])=><button key={href} onClick={()=>navigate(href)} aria-pressed={path===href}>{label}</button>)}</nav></div>
  <div className="admin-commerce" data-admin-site={site}><AdminSidebar key={site} siteKey={site}/><main className="commerce-main"><AdminWorkspaceHeader siteKey={site}/><div id="admin-content" tabIndex={-1} className="commerce-content">
   {path==='/admin'||path==='/admin/operations'||path==='/admin/visits'?<Summary key={site} site={site}/>
   :path==='/admin/orders'?<OrdersClient key={site}/>
   :path==='/admin/shipments'?<ShippingPreview key={site}/>
   :path==='/admin/products'?<ProductPreview key={site} site={site}/>
   :path==='/admin/settlements'?<SettlementPreview key={site} site={site}/>
   :path==='/admin/members'?<MembersClient key={site}/>
   :path==='/admin/reviews'?<ReviewsClient key={site}/>
   :path==='/admin/reservations'&&site==='blendpick'?<ReservationsClient/>
   :<section className="overview-panel"><h1>업무 상세 화면</h1><p style={{margin:'14px 0',fontSize:14,lineHeight:1.8}}>이 미리보기에서 운영 홈·주문·배송반품·상품·정산·회원·리뷰·숙박예약 구성을 확인할 수 있습니다. 상세 편집과 실제 처리는 운영 화면에서 제공됩니다.</p><p style={{fontSize:12,color:'#68747c'}}>선택한 경로: {path}</p><button className="overview-refresh" style={{marginTop:20}} onClick={()=>navigate('/admin')}>운영 홈으로 돌아가기</button></section>}
  </div></main></div>
 </div></SiteProvider>;
}
createRoot(document.getElementById('app')!).render(<App/>);
