// Illustrative fixtures only. These graphs use the same components as admin pages; no API requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MonitoringOverview from '@/components/admin/MonitoringOverview';
import SalesCharts from '@/components/admin/charts/SalesCharts';
import ProfitCharts from '@/components/admin/charts/ProfitCharts';
import MetricChart from '@/components/admin/charts/MetricChart';
import type { ServerTraffic, TrafficTotals } from '@/lib/server-traffic';
import type { SalesBucket, SalesSummary } from '@/lib/sales-statistics';
import type { VisitSummary } from '@/lib/visit-analytics/rules';
const total=(n:number):TrafficTotals=>({requests:n,sentBytes:n*18000,receivedBytes:n*310,errors4xx:Math.floor(n*.015),errors5xx:Math.floor(n*.002),botRequests:Math.floor(n*.2),monitorRequests:10,otherRequests:n-Math.floor(n*.2)-10,slowRequests:Math.floor(n*.01),averageMs:126,error5xxPercent:.2});
function Preview(){
 const [view,setView]=useState('monitor'),[days,setDays]=useState(7),[site,setSite]=useState<'blendpick'|'sanjipick'>('blendpick'),[error,setError]=useState(false);
 const factor=site==='blendpick'?1:.55;
 const from=new Date(Date.UTC(2026,8,9-days+1,-9)),now=new Date('2026-09-09T05:00:00Z');
 const daily=Array.from({length:days},(_,i)=>{const n=Math.round((80+(i*17)%65)*factor);return {day:new Date(+from+i*86400000+9*3600000).toISOString().slice(0,10),visitors:n,sessions:n+30,pageviews:(n+30)*4};});
 const pv=daily.reduce((s,d)=>s+d.pageviews,0);
 const summary:VisitSummary={site,days,state:error?'error':'active',from:from.toISOString(),to:now.toISOString(),lastEventAt:now.toISOString(),totals:error?null:{visitors:Math.round(daily.reduce((s,d)=>s+d.visitors,0)*(days===1?1:.72)),sessions:daily.reduce((s,d)=>s+d.sessions,0),pageviews:pv},daily:error?[]:daily,pages:error?[]:[{page:'product',views:Math.round(pv*.5)},{page:'home',views:Math.round(pv*.25)},{page:'catalog',views:Math.round(pv*.15)},{page:'cart',views:pv-Math.round(pv*.5)-Math.round(pv*.25)-Math.round(pv*.15)}]};
 const hours=Array.from({length:(days-1)*24+14},(_,i)=>({hour:new Date(+from+i*3600000).toISOString(),...total(Math.round((100+Math.pow(Math.sin(i/5),2)*750)*factor)),averageMs:100+(i*31)%260}));
 const req=hours.reduce((s,h)=>s+h.requests,0),tt=total(req);
 tt.botRequests=hours.reduce((s,h)=>s+h.botRequests,0);tt.monitorRequests=hours.reduce((s,h)=>s+h.monitorRequests,0);tt.otherRequests=req-tt.botRequests-tt.monitorRequests;tt.errors5xx=hours.reduce((s,h)=>s+h.errors5xx,0);tt.averageMs=hours.reduce((s,h)=>s+h.averageMs*h.requests,0)/req;
 const traffic:ServerTraffic={site,days,state:error?'error':'ready',generatedAt:now.toISOString(),captureStartedAt:from.toISOString(),from:from.toISOString(),effectiveFrom:from.toISOString(),totals:error?null:tt,hours:error?[]:hours,routes:error?[]:[{route:'assets',...total(Math.floor(req*.55))},{route:'products',...total(Math.floor(req*.3))},{route:'api',...total(req-Math.floor(req*.55)-Math.floor(req*.3))}]};
 const salesDaily:SalesBucket[]=daily.map((d,i)=>({label:d.day,gross:d.visitors*35000,refunds:i%3===0?70000:0,net:d.visitors*35000-(i%3===0?70000:0),orders:d.visitors,unresolved:0}));
 const totals=salesDaily.reduce((s,d)=>({...s,gross:s.gross+d.gross,refunds:s.refunds+d.refunds,net:s.net!+d.net!,orders:s.orders+d.orders}),{label:'합계',gross:0,refunds:0,net:0,orders:0,unresolved:0} as SalesBucket);
 const channel={...totals,label:'전시',gross:Math.round(totals.gross*.7),refunds:Math.round(totals.refunds*.7),net:Math.round(totals.gross*.7)-Math.round(totals.refunds*.7),orders:Math.round(totals.orders*.7)};
 const sales:SalesSummary={days,from:daily[0].day,to:daily.at(-1)!.day,totals,daily:salesDaily,channels:[channel,{...totals,label:'비전시',gross:totals.gross-channel.gross,refunds:totals.refunds-channel.refunds,net:totals.net!-channel.net,orders:totals.orders-channel.orders}]};
 const profits=['제철 과일 공구','건강 식품 공구','자사몰 일반판매','생활용품 공구'].map((label,i)=>({label,channel:'shop',orders:130-i*12,gross:(4500000-i*800000)*factor,net_profit:i===2?null:i===3?-190000:(620000-i*150000)*factor,sales_vat:80000,supply_cost:2600000-i*500000,shipping_cost:90000,pg_fee:88000,other_costs:60000,commission:130000}));
 return <div className="min-h-screen bg-stone-100 text-stone-800" onClick={e=>{const a=(e.target as HTMLElement).closest('a');if(a?.getAttribute('href')?.startsWith('?days=')){e.preventDefault();setDays(Number(a.getAttribute('href')!.split('=')[1]));}}}>
  <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#193e31] px-5 py-4 text-white"><div><b>관리자 통계 그래프</b><p className="mt-1 text-xs text-emerald-100">변경 미리보기 · 모든 숫자는 설명용 예시</p></div><div className="flex gap-2"><select aria-label="사이트" value={site} onChange={e=>setSite(e.target.value as typeof site)} className="rounded-lg bg-white p-2 text-sm text-stone-800"><option value="blendpick">블랜드픽</option><option value="sanjipick">산지픽</option></select><button className="rounded-lg border border-white/40 px-3 text-xs" onClick={()=>setError(!error)}>{error?'정상 예시로':'조회 실패 보기'}</button></div></header>
  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8"><nav className="mb-4 flex flex-wrap gap-2">{[['monitor','방문·트래픽'],['sales','매출·판매 채널'],['profit','손익·정산']].map(([key,label])=><button key={key} onClick={()=>setView(key)} aria-pressed={view===key} className={`rounded-xl px-5 py-3 text-sm font-semibold ${view===key?'bg-white text-emerald-900 shadow-sm':'text-stone-500'}`}>{label}</button>)}</nav>
  {view==='monitor'?<MonitoringOverview key={site+days+error} siteName={site==='blendpick'?'블랜드픽':'산지픽'} summary={summary} traffic={traffic} example/>:error?<p role="alert" className="rounded-xl bg-amber-50 p-8">통계를 불러오지 못했습니다. 실제 화면에서도 조회 실패를 0원으로 표시하지 않습니다.</p>:view==='sales'?<SalesCharts data={sales}/>:<div className="space-y-6"><h1 className="text-2xl font-bold">손익과 정산을 한눈에</h1><p className="text-sm text-stone-500">순이익 미확정 사례와 손실 사례도 포함한 예시입니다.</p><ProfitCharts rows={profits}/><MetricChart title="정산 예상액·수수료 추이" description="정산일 기준 · 실제 입금액과 대조 필요" points={salesDaily.map((d,i)=>({label:d.label.slice(5),values:[i===2?null:d.net!*.88,d.gross*.0363]}))} series={[{label:'정산 예상액',color:'#315e43'},{label:'수수료',color:'#b87a28'}]} unit="won" kind="bar"/></div>}
  </div>
 </div>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
