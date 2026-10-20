import Link from 'next/link';
import type {SiteKey} from '@/lib/sites';
import type {SalesSummary} from '@/lib/sales-statistics';
import type {WorkGroup} from '@/lib/operations';
import type {ServerTraffic} from '@/lib/server-traffic';
import {PAGE_LABELS,type VisitSummary} from '@/lib/visit-analytics/rules';
import {kstDay} from '@/lib/admin-chart-data';
import {overviewVisitPoints} from '@/lib/admin-overview';
import MetricChart from '@/components/admin/charts/MetricChart';
import OverviewWorkQueue from '@/components/admin/OverviewWorkQueue';
import DashboardRefresh from '@/components/admin/DashboardRefresh';
import AdminIcon from '@/components/admin/AdminIcon';
export type DashboardStats={liveGongu:number;upcoming:number;newOrders:number;preparingOrders:number;shippedOrders:number;todaySettlement:number|null};
const number=(v:number|null|undefined,suffix='')=>v==null?'확인 필요':v.toLocaleString('ko-KR')+suffix;
const time=(value:string)=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const visitStates={active:'수집 기록 있음',empty:'아직 수집 기록 없음',disabled:'방문 수집 꺼짐',unconfigured:'통계 연결 미설정',error:'방문 통계 조회 실패'};
export default function AdminDashboardView({siteKey,siteName,date,stats,sales,visits,workGroups,workUnavailable=[],traffic}:{siteKey:SiteKey;siteName:string;date:string;stats:DashboardStats|null;sales:SalesSummary|null;visits:VisitSummary;workGroups:WorkGroup[];workUnavailable?:string[];traffic?:ServerTraffic}){
 const today=sales?.daily.at(-1),visitValid=visits.state==='active'||visits.state==='empty';
 const todayVisitors=visitValid?(visits.daily.find(d=>d.day===kstDay(visits.to))?.visitors??0):null;
 const days=visits.days;
 const kpis=[
  {label:'오늘 순 결제액',value:number(today?.net,'원'),hint:'확인된 환불 반영 · 배송비 포함',href:'/admin/settlements',accent:true},
  {label:'오늘 결제 주문',value:number(today?.orders,'건'),hint:'실제 결제 기준 · 테스트 제외',href:'/admin/orders'},
  {label:'오늘 수집된 방문자',value:number(todayVisitors,'명'),hint:'브라우저 기준 · 관리자 제외',href:'#visits'},
  {label:'오늘 정산 예상액',value:number(stats?.todaySettlement,'원'),hint:'배송완료 기준 · 실제 입금과 대조',href:'/admin/settlements?period=today'},
 ];
 return <div className="commerce-dashboard overview-dashboard">
  <div className="overview-intro"><div><h1>{siteName} 운영 홈</h1><p>{date} · 한국시간 기준</p></div><DashboardRefresh/></div>
  <div className="overview-kpis">{kpis.map(k=><Link prefetch={false} key={k.label} href={k.href} className={`overview-kpi ${k.accent?'is-accent':''}`}><span>{k.label}<AdminIcon name="arrow"/></span><strong>{k.value}</strong><small>{k.hint}</small></Link>)}</div>
  <div className="overview-operating-grid">
   <OverviewWorkQueue groups={workGroups} unavailable={workUnavailable}/>
   <aside className="overview-panel overview-current" aria-label="현재 주문과 상품 현황"><div className="overview-section-heading"><div><h2>현재 운영 현황</h2><p>전체 기간 · 상품 주문 상태 기준</p></div></div>
    <div className="overview-current-list">{[
     {label:'발주 전 주문',value:stats?.newOrders,href:'/admin/shipments#flow-ready',note:'결제 완료·주문 확인'},
     {label:'배송 준비',value:stats?.preparingOrders,href:'/admin/shipments#flow-preparing',note:'공급사 출고·송장 확인'},
     {label:'배송 중',value:stats?.shippedOrders,href:'/admin/shipments#flow-shipped',note:'배송 추적·완료 확인'},
     {label:'진행 중 공구',value:stats?.liveGongu,href:'/admin/products',note:'현재 판매 기간'},
     {label:'오픈 예정',value:stats?.upcoming,href:'/admin/products',note:'판매 시작 전 상품'},
    ].map(x=><Link key={x.label} href={x.href} prefetch={false}><span><b>{x.label}</b><small>{x.note}</small></span><strong>{x.value==null?'—':x.value.toLocaleString()}<small>건</small></strong><AdminIcon name="arrow"/></Link>)}</div>
    {!stats&&<p role="alert" className="overview-warning">운영 현황을 불러오지 못했습니다.</p>}
    <div className="overview-shortcuts"><Link href="/admin/products/new"><AdminIcon name="plus"/>상품 등록</Link><Link href="/admin/notifications"><AdminIcon name="bell"/>카카오 상담·알림</Link>{siteKey==='blendpick'&&<Link href="/admin/dangung"><AdminIcon name="calendar"/>단궁 예약·요금</Link>}</div>
   </aside>
  </div>
  <section id="performance" className="overview-performance" aria-labelledby="performance-title">
   <div className="overview-section-heading overview-performance-heading"><div><h2 id="performance-title">매출과 방문 흐름</h2><p>같은 기간의 판매·방문 현황을 함께 확인하세요.</p></div><nav className="overview-period" aria-label="매출·방문 공통 조회 기간">{[1,7,30].map(d=><Link key={d} href={`/admin?days=${d}#performance`} prefetch={false} aria-current={days===d?'page':undefined}>{d===1?'오늘':`최근 ${d}일`}</Link>)}</nav></div>
   <div className="overview-chart-grid">
    <section className="overview-panel overview-chart-panel" aria-labelledby="sales-title"><div className="overview-insight-title"><div><h3 id="sales-title">순 결제액</h3><strong>{number(sales?.totals.net,'원')}</strong></div><span>결제 {number(sales?.totals.orders,'건')}</span></div>
     {sales?<><p className="overview-footnote">{sales.from} ~ {sales.to} · 한국시간 결제일 기준</p>{sales.totals.unresolved>0&&<p className="overview-warning" role="status">환불 대조 {sales.totals.unresolved}건 · 해당 금액은 확인 필요로 표시합니다.</p>}
      {sales.totals.orders>0?<div className="overview-chart"><MetricChart title="일별 결제·환불" description="배송비 포함. 선택한 주문의 환불을 현재까지 반영합니다." points={sales.daily.map(d=>({label:d.label.slice(5),values:[d.gross,d.refunds,d.net]}))} series={[{label:'총 결제',color:'#7396b5'},{label:'환불',color:'#c16c4d'},{label:'순 결제',color:'#3c6549'}]} unit="won"/></div>:<p className="overview-empty">선택한 기간에 결제된 주문이 없습니다.</p>}
      <div className="overview-mini-table" aria-label="전시·비전시 실적 요약">{sales.channels.map(c=><div key={c.label}><span>{c.label} 판매</span><small>{number(c.orders,'건')}</small><b>{number(c.net,'원')}</b></div>)}</div>
     </>:<p className="overview-empty" role="alert">매출을 불러오지 못했습니다. 새로고침해 주세요.</p>}
     <div className="overview-inline-links"><Link href="/admin/settlements">정산 내역</Link><Link href="/admin/profit">원가·수익 분석</Link><Link href="/admin/link-sales">상품별 판매 실적</Link></div>
    </section>
    <section id="visits" className="overview-panel overview-chart-panel" aria-labelledby="visits-title"><div className="overview-insight-title"><div><h3 id="visits-title">기간 내 방문자</h3><strong>{number(visitValid?visits.totals?.visitors:null,'명')}</strong></div><span className={!visitValid?'overview-state-warning':''}>{visitStates[visits.state]}</span></div>
     {visitValid?<><p className="overview-footnote">세션 {number(visits.totals?.sessions,'회')} · 페이지 조회 {number(visits.totals?.pageviews,'회')} · 기간 내 중복 방문자 제외</p>{visits.daily.length>0?<div className="overview-chart"><MetricChart title="일별 방문·조회" description="수집 기록이 없는 날짜는 빈 구간입니다. 방문이 없었다는 뜻은 아닙니다." points={overviewVisitPoints(visits)} series={[{label:'방문자',color:'#3c6549'},{label:'페이지 조회',color:'#7396b5'}]}/></div>:<p className="overview-empty">방문 기록이 쌓이면 추이가 표시됩니다.</p>}
      <div className="overview-mini-table" aria-label="많이 본 화면">{visits.pages.slice(0,3).map(p=><div key={p.page}><span>{PAGE_LABELS[p.page]||'기타'}</span><b>{number(p.views,'회')}</b></div>)}{!visits.pages.length&&<p className="overview-footnote">선택 기간에 수집된 화면 조회가 없습니다.</p>}</div>
     </>:<p className="overview-empty" role="status">{visits.state==='error'?'통계 조회에 실패했습니다. 새로고침 후 다시 확인해 주세요.':'수집 설정을 확인하면 이곳에서 방문 추이를 볼 수 있습니다.'}</p>}
     <p className="overview-footnote">최근 수신 {visits.lastEventAt?time(visits.lastEventAt):'기록 없음'} · 관리자·식별된 봇·분석 거부 방문 제외</p>
    </section>
   </div>
  </section>
  <footer className="overview-system"><span><AdminIcon name="settings"/>서버 관측</span><p>{traffic?.totals?`오늘 서버 오류 ${number(traffic.totals.errors5xx,'건')} · 최근 집계 ${traffic.generatedAt?time(traffic.generatedAt):'확인 필요'}`:'서버 집계 결과를 확인해 주세요.'}{traffic&&traffic.state!=='ready'?' · 최신 집계 확인 필요':''}</p><Link href="/admin/traffic">트래픽·자동 점검 <AdminIcon name="arrow"/></Link></footer>
 </div>;
}
