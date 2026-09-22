import Link from 'next/link';
import type { SiteKey } from '@/lib/sites';
import type { SalesSummary } from '@/lib/sales-statistics';
import SalesCharts from './charts/SalesCharts';
import AdminIcon, {type AdminIconName} from './AdminIcon';
export type DashboardStats = {liveGongu:number;upcoming:number;newOrders:number;zeroStock:number;newReviews:number;todaySettlement:number};
export default function AdminDashboardView({siteKey,siteName,date,stats,sales}:{siteKey:SiteKey;siteName:string;date:string;stats:DashboardStats|null;sales:SalesSummary|null}) {
 const today=sales?.daily.at(-1);
 const kpis:{label:string;value:string;sub:string;href:string;icon:AdminIconName;tone:string}[]=[
  {label:'오늘 순 결제액',value:today?.net==null?'확인 필요':`${today.net.toLocaleString()}원`,sub:'배송비 포함 · 확인된 환불 반영',href:'/admin/settlements',icon:'wallet',tone:'accent'},
  {label:'오늘 주문',value:today?`${today.orders.toLocaleString()}건`:'확인 필요',sub:'실제 결제 기준 · 테스트 제외',href:'/admin/orders',icon:'box',tone:'white'},
  {label:'진행 중 공구',value:stats?`${stats.liveGongu.toLocaleString()}건`:'확인 필요',sub:stats?`오픈 예정 ${stats.upcoming.toLocaleString()}건`:'공구 현황 조회 필요',href:'/admin/products',icon:'calendar',tone:'white'},
  {label:'오늘 정산액',value:stats?`${stats.todaySettlement.toLocaleString()}원`:'확인 필요',sub:'배송완료 기준',href:'/admin/settlements',icon:'chart',tone:'peach'},
 ];
 const tasks=[
  {label:'신규 주문 확인',sub:'결제 완료된 주문을 확인하세요',value:stats?.newOrders,href:'/admin/orders',icon:'box' as const},
  {label:'재고 없는 판매 상품',sub:'재고 보충 또는 판매 상태 점검',value:stats?.zeroStock,href:'/admin/products',icon:'check' as const},
  {label:'최근 7일 새 리뷰',sub:'구매 후기를 확인하세요',value:stats?.newReviews,href:'/admin/reviews',icon:'users' as const},
 ];
 return <div className="commerce-dashboard">
  <div className="commerce-page-intro"><div><p className="commerce-eyebrow">TODAY, AT A GLANCE</p><h1>{siteName} 운영 요약</h1><p>오늘의 판매 흐름과 다음 업무를 한눈에 확인하세요.</p></div><span className="commerce-date"><AdminIcon name="calendar"/>{date} · 한국시간</span></div>
  <div className="commerce-kpi-grid">{kpis.map(k=><Link key={k.label} href={k.href} className={`commerce-kpi commerce-kpi-${k.tone}`}><div className="commerce-kpi-top"><span className="commerce-kpi-icon"><AdminIcon name={k.icon}/></span><span>{k.label}</span><AdminIcon name="arrow"/></div><strong>{k.value}</strong><p>{k.sub}</p></Link>)}</div>
  <div className="commerce-dashboard-grid"><div className="commerce-dashboard-primary">
   {sales?<SalesCharts data={sales} compact/>:<section className="commerce-panel commerce-dashboard-error" role="alert"><AdminIcon name="chart"/><h2>매출 흐름을 불러오지 못했습니다</h2><p>새로고침 후 다시 확인해주세요. 조회되지 않은 금액은 0원으로 표시하지 않습니다.</p><Link href="/admin">다시 조회하기 →</Link></section>}
   <section className="commerce-workflow-card"><div className="commerce-card-heading"><div><p className="commerce-eyebrow">WORKFLOW</p><h2>판매 운영, 다음 단계로</h2></div><span>자주 처리하는 업무</span></div><nav aria-label="자주 처리하는 업무" className="commerce-workflow-steps">{[
    {href:'/admin/products/new',label:'상품 등록',sub:'새로운 판매 준비',icon:'plus' as const},
    {href:'/admin/orders',label:'주문 확인',sub:'결제와 주문 검토',icon:'box' as const},
    {href:'/admin/shipments',label:'출고·송장 처리',sub:'배송 준비와 발송',icon:'truck' as const},
    {href:'/admin/settlements',label:'결제 정산',sub:'정산 내역 확인',icon:'wallet' as const},
   ].map((item,i)=><Link href={item.href} key={item.href}><span className="commerce-step-number">0{i+1}</span><AdminIcon name={item.icon}/><strong>{item.label}</strong><small>{item.sub}</small><span className="commerce-step-arrow"><AdminIcon name="arrow"/></span></Link>)}</nav></section>
  </div><aside className="commerce-dashboard-secondary" aria-label="운영 업무 현황">
   <section className="commerce-attention-card"><div className="commerce-card-heading"><h2>확인할 업무</h2><span className="commerce-round-icon"><AdminIcon name="check"/></span></div><p>주문부터 재고까지, 놓치지 않도록</p>{!stats&&<p role="alert">업무 현황을 불러오지 못했습니다.</p>}<div className="commerce-task-list">{tasks.map(t=><Link key={t.href} href={t.href}><span className="commerce-task-icon"><AdminIcon name={t.icon}/></span><span><strong>{t.label}</strong><small>{t.sub}</small></span><b>{t.value==null?'—':t.value.toLocaleString()}<small>{t.value==null?'':'건'}</small></b></Link>)}</div><Link href="/admin/operations" className="commerce-attention-footer">오늘 처리할 일 전체 보기 <AdminIcon name="arrow"/></Link></section>
   <Link href="/admin/shipments" className="commerce-feature-card"><span className="commerce-eyebrow">FULFILLMENT</span><h2>{siteKey==='sanjipick'?'농가 출고부터':'주문 확인부터'}<br/>배송 완료까지.</h2><p>발주 · 송장 · 배송 현황을<br/>하나의 화면에서 이어서 처리하세요.</p><div className="commerce-feature-bottom"><span className="commerce-feature-tag">배송 관리 열기</span><span className="commerce-round-icon"><AdminIcon name="arrow"/></span></div><span className="commerce-feature-decoration" aria-hidden="true"/></Link>
   <Link href={siteKey==='blendpick'?'/admin/dangung':'/admin/influencers'} className="commerce-secondary-link"><AdminIcon name={siteKey==='blendpick'?'calendar':'users'}/><span><strong>{siteKey==='blendpick'?'단궁 예약·요금':'공구 파트너 관리'}</strong><small>{siteKey==='blendpick'?'예약 일정과 판매 요금 확인':'파트너와 진행 중인 공구 확인'}</small></span><AdminIcon name="arrow"/></Link>
  </aside></div>
 </div>;
}
