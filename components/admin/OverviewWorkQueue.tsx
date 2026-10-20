'use client';
import Link from 'next/link';
import {useState} from 'react';
import type {WorkGroup} from '@/lib/operations';
import {overviewWorkItems} from '@/lib/admin-overview';
import AdminIcon from '@/components/admin/AdminIcon';
export default function OverviewWorkQueue({groups,unavailable=[]}:{groups:WorkGroup[];unavailable?:string[]}){
 const [choice,setFilter]=useState('all'),[limit,setLimit]=useState(6);
 const filter=groups.some(g=>g.key===choice)?choice:'all';
 const items=overviewWorkItems(groups),filtered=items.filter(i=>filter==='all'||i.group===filter),shown=filtered.slice(0,limit);
 const total=groups.reduce((n,g)=>n+g.total,0),visibleTotal=filter==='all'?total:groups.find(g=>g.key===filter)?.total||0;
 const active=groups.filter(g=>g.total>0);
 return <section id="work" className="overview-panel overview-work" aria-labelledby="work-title">
  <div className="overview-section-heading"><div><h2 id="work-title">먼저 확인할 일 <span className="overview-count">{unavailable.length?(groups.length?`확인된 ${total.toLocaleString()}`:'—'):total.toLocaleString()}</span></h2><p>취소·결제 확인을 우선으로, 처리 화면까지 바로 연결됩니다.</p></div><label className="overview-filter"><span className="sr-only">확인할 업무 종류</span><select value={filter} onChange={e=>{setFilter(e.target.value);setLimit(6);}}><option value="all">모든 업무</option>{groups.map(g=><option key={g.key} value={g.key}>{g.title} ({g.total})</option>)}</select></label></div>
  {unavailable.length>0&&<p className="overview-warning" role="alert">{unavailable.join(' · ')}을 불러오지 못했습니다. 표시된 건수는 확인된 항목만 포함합니다. 새로고침해 주세요.</p>}
  {active.length>0&&<div className="overview-work-counts">{active.map(g=><span key={g.key}>{g.title}<b>{g.total.toLocaleString()}</b></span>)}</div>}
  <div className="overview-work-list">{shown.map(item=><article className="overview-work-row" key={item.key}>
   <span className={`overview-priority ${item.priority==='first'?'is-first':''}`}>{item.priority==='first'?'우선':'확인'}</span>
   <div className="overview-work-copy"><div><strong>{item.label}</strong><span>{item.groupTitle}</span></div><p>{item.detail}</p><small>{item.elapsed}</small></div>
   <Link href={item.href} prefetch={false} className="overview-work-action" aria-label={`${item.label} ${item.actionLabel}`} title={item.nextAction}>{item.actionLabel}<AdminIcon name="arrow"/></Link>
  </article>)}</div>
  {!filtered.length&&<p className="overview-empty"><AdminIcon name="check"/>{unavailable.length?'확인된 항목이 없습니다. 조회 실패 항목은 다시 확인해 주세요.':'현재 확인이 필요한 항목이 없습니다.'}</p>}
  {filtered.length>limit&&<button type="button" className="overview-more" onClick={()=>setLimit(n=>n+12)}>나머지 {filtered.length-limit}개 항목 더 보기</button>}
  {visibleTotal>filtered.length&&<p className="overview-footnote">{visibleTotal.toLocaleString()}건 중 우선 확인할 {filtered.length.toLocaleString()}건을 불러왔습니다. 처리 후 새로고침하면 다음 항목이 표시됩니다.</p>}
  <p className="overview-footnote">업무 항목 기준으로 한 주문이 여러 번 표시될 수 있습니다. 미출고는 결제 후 72시간 경과 기준이며, 예약 출고일을 먼저 확인하세요.</p>
 </section>;
}
