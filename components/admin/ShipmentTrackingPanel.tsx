'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiErrorMessage, readApiJson } from '@/lib/api-error-message';
import type { ShipmentTrackingResult, ShipmentTrackingRun } from '@/lib/shipment-tracking-types';

const endpoint = '/api/admin/shipments/track';
const statusLabels = {running:'조회 중',success:'정상 완료',partial:'일부 실패',failed:'확인 필요',empty:'대상 없음'};
const statusColors = {running:'bg-blue-50 text-blue-700',success:'bg-green-50 text-green-800',partial:'bg-amber-50 text-amber-800',failed:'bg-red-50 text-red-700',empty:'bg-gray-100 text-gray-600'};
const outcomeLabels = {delivered:'배송완료 반영',in_transit:'배송중',failed:'실패',skipped:'건너뜀'};
function time(value: string) {
 return new Date(value).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
}
function duration(run: ShipmentTrackingRun) {
 if (!run.finished_at) return run.status==='running' ? '진행 중' : '중단';
 const seconds = Math.max(0, (Date.parse(run.finished_at)-Date.parse(run.started_at))/1000);
 return seconds>=60 ? `${Math.floor(seconds/60)}분 ${Math.round(seconds%60)}초` : `${seconds.toFixed(1)}초`;
}

export default function ShipmentTrackingPanel({onChanged}: {onChanged?:()=>Promise<void>}) {
 const [runs,setRuns] = useState<ShipmentTrackingRun[]>([]);
 const [keyConfigured,setKeyConfigured] = useState<boolean|null>(null);
 const [loading,setLoading] = useState(true);
 const [busy,setBusy] = useState(false);
 const [historyError,setHistoryError] = useState('');
 const [actionMessage,setActionMessage] = useState('');
 const [actionError,setActionError] = useState(false);
 const [details,setDetails] = useState<Record<string,ShipmentTrackingResult[]>>({});
 const [detailErrors,setDetailErrors] = useState<Record<string,string>>({});
 const [failedOnly,setFailedOnly] = useState(false);
 const requestActive = useRef(false);
 const detailActive = useRef(new Set<string>());
 const mounted = useRef(true);
 const historyVersion = useRef(0);
 const refresh = useCallback(async () => {
  const version = ++historyVersion.current;
  try {
   const response = await fetch(endpoint, {cache:'no-store'});
   const data = await readApiJson(response);
   if (!response.ok || !Array.isArray(data.runs)) throw Error(apiErrorMessage(data,'조회 이력을 불러오지 못했습니다.'));
   if (mounted.current && version===historyVersion.current) {
    setRuns(data.runs); setKeyConfigured(!!data.keyConfigured); setHistoryError('');
   }
  } catch (error) {
   if (mounted.current && version===historyVersion.current) setHistoryError(apiErrorMessage(error,'조회 이력을 불러오지 못했습니다.'));
  } finally { if (mounted.current) setLoading(false); }
 }, []);
 const running = runs.some(run=>run.status==='running');
 useEffect(() => {
  mounted.current=true;
  void refresh();
  const tick=()=>{if(document.visibilityState==='visible') void refresh();};
  const timer=window.setInterval(tick, running || busy ? 5000 : 60000);
  document.addEventListener('visibilitychange',tick);
  return ()=>{mounted.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
 }, [refresh,running,busy]);

 async function showDetails(run: ShipmentTrackingRun) {
  if (run.status==='running' || details[run.id] || detailActive.current.has(run.id)) return;
  detailActive.current.add(run.id);
  setDetailErrors(previous=>({...previous,[run.id]:''}));
  try {
   const response=await fetch(`${endpoint}?run=${run.id}`,{cache:'no-store'});
   const data=await readApiJson(response);
   if (!response.ok || !Array.isArray(data.run?.results)) throw Error(apiErrorMessage(data,'주문별 결과를 불러오지 못했습니다.'));
   if (mounted.current) setDetails(previous=>({...previous,[run.id]:data.run.results}));
  } catch (error) {
   if (mounted.current) setDetailErrors(previous=>({...previous,[run.id]:apiErrorMessage(error)}));
  } finally { detailActive.current.delete(run.id); }
 }

 async function lookup() {
  if (requestActive.current || running) return;
  requestActive.current=true;setBusy(true);setActionMessage('');
  try {
   const response=await fetch(endpoint,{method:'POST'});
   const data=await readApiJson(response);
   if (!mounted.current) return;
   if (data.run) {
    const run=data.run as ShipmentTrackingRun;
    setRuns(previous=>[run,...previous.filter(item=>item.id!==run.id)].slice(0,10));
    if(run.results) setDetails(previous=>({...previous,[run.id]:run.results!}));
    const hasError=run.status==='failed' || run.status==='partial';
    setActionError(hasError);
    setActionMessage(run.message || (hasError ? `조회 ${run.checked}건 중 ${run.failed}건을 확인해주세요. 이력에서 실패 사유를 볼 수 있습니다.` : `조회 ${run.checked}건 완료 · 배송완료 ${run.delivered}건 반영`));
   } else if (!response.ok) {
    setActionError(true);setActionMessage(apiErrorMessage(data,'조회 요청 결과를 확인하지 못했습니다. 아래 이력을 확인해주세요.'));
   }
  } catch (error) {
   if (mounted.current) {setActionError(true);setActionMessage(apiErrorMessage(error,'응답을 받지 못했습니다. 조회가 계속 진행될 수 있으니 아래 이력을 확인해주세요.'));}
  } finally {
   await Promise.allSettled([refresh(),onChanged?.()]);
   requestActive.current=false;
   if (mounted.current) setBusy(false);
  }
 }

 const latest=runs[0];
 return <section aria-label="배송 자동조회" className="ops-tracking-panel">
  <div className="ops-tracking-summary">
   <div><div className="ops-tracking-title"><h2>배송 자동조회</h2><span className={keyConfigured===false?'ops-warning':'ops-meta'}>{keyConfigured===null?'연동 상태 확인 중':keyConfigured?'API 키 등록됨':'연동 설정 필요'}</span></div><p>매일 07:30 · 19:30 자동 조회 예정 (한국시간)</p></div>
   <div className="ops-tracking-latest">{latest?<><span className={`ops-status ${statusColors[latest.status]}`}>{statusLabels[latest.status]}</span><span>최근 조회 {time(latest.started_at)}</span><strong>{latest.status==='running'?'조회 중':`조회 ${latest.checked} · 완료 ${latest.delivered} · 배송중 ${latest.in_transit} · 실패 ${latest.failed}`}</strong></>:<span>{loading?'이력 확인 중':historyError?'이력 확인 실패':'저장된 조회 이력 없음'}</span>}</div>
   <button type="button" onClick={()=>void lookup()} disabled={busy||running||keyConfigured!==true} aria-busy={busy||running} className="ops-button ops-button-primary">{busy||running?'배송조회 중…':'지금 배송조회'}</button>
  </div>
  <div className="ops-tracking-feedback">
   {actionMessage && <p role={actionError?'alert':'status'} className={`mt-3 px-3 py-2 text-xs leading-5 ${actionError?'bg-amber-50 text-amber-900':'bg-green-50 text-green-800'}`}>{actionMessage}</p>}
   {historyError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-xs text-red-700"><span>{historyError}</span><button type="button" onClick={()=>void refresh()} className="underline">이력 다시 불러오기</button></div>}
   {latest?.message&&<p className={`text-xs leading-5 ${latest.status==='failed'?'text-red-700':'text-gray-500'}`}>{latest.message}</p>}
   <details className="ops-details ops-tracking-history">
    <summary>조회 이력·주문별 결과 {runs.length>0?`(${runs.length}회)`:''}</summary>
    <p className="ops-meta">현재 사이트의 배송중 주문을 오래된 조회 순으로 확인합니다. 자동 회당 최대 80건 · 직접 최대 100건. 배송완료 주문은 제외합니다.</p>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <h3 className="text-xs font-bold text-gray-700">최근 조회 이력 <span className="font-normal text-gray-400">· 최근 10회</span></h3>
    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={failedOnly} onChange={event=>setFailedOnly(event.target.checked)} className="accent-[#2D5A27]"/>실패한 주문만 보기</label>
   </div>
   {loading && !runs.length ? <p role="status" className="py-5 text-xs text-gray-400">조회 이력을 불러오는 중입니다.</p>
    : !runs.length && !historyError ? <p className="py-5 text-xs leading-5 text-gray-500">아직 저장된 조회 이력이 없습니다. 지금 배송조회를 실행하면 이곳에 결과가 남습니다.</p> : null}
   <div className="mt-2 divide-y divide-gray-100">
    {runs.map(run=><details key={run.id} onToggle={event=>{if(event.currentTarget.open)void showDetails(run);}}>
     <summary className="cursor-pointer py-3 text-xs text-gray-600 marker:text-gray-400">
      <span className={`ml-1 mr-2 inline-block px-2 py-1 font-semibold ${statusColors[run.status]}`}>{statusLabels[run.status]}</span>
      <span className="mr-2 font-semibold text-gray-700">{run.source==='automatic'?'자동':'직접'}</span>
      <time dateTime={run.started_at} className="tnum">{time(run.started_at)}</time>
      <span className="mt-1 block pl-5 leading-5 text-gray-500">{run.status==='running'?'조회 진행 중':`조회 ${run.checked} · 완료 반영 ${run.delivered} · 배송중 ${run.in_transit} · 실패 ${run.failed}${run.skipped?` · 건너뜀 ${run.skipped}`:''}`} · {duration(run)}</span>
     </summary>
     <div className="mb-3 border border-gray-100 bg-gray-50 p-3">
      {run.message && <p className="mb-2 text-xs leading-5 text-gray-600">{run.message}</p>}
      {run.status==='running' ? <p className="text-xs text-gray-500">조회 중입니다. 완료되면 이력을 다시 펼쳐 결과를 확인할 수 있습니다.</p>
       : detailErrors[run.id] ? <p role="alert" className="text-xs text-red-700">{detailErrors[run.id]} <button type="button" className="underline" onClick={()=>void showDetails(run)}>다시 불러오기</button></p>
       : !details[run.id] ? <p role="status" className="text-xs text-gray-500">주문별 결과를 불러오는 중입니다.</p>
       : <>
        {!details[run.id].filter(row=>!failedOnly||row.outcome==='failed').length && <p className="text-xs text-gray-500">{failedOnly?'실패한 주문이 없습니다.':'이번 실행에서 조회한 주문이 없습니다.'}</p>}
        <ul className="max-h-80 space-y-2 overflow-y-auto">
         {details[run.id].filter(row=>!failedOnly||row.outcome==='failed').map(row=><li key={row.order_id} className="border border-gray-100 bg-white px-3 py-2 text-xs leading-5">
          <div className="flex flex-wrap items-center gap-2"><span className={`font-bold ${row.outcome==='failed'?'text-red-700':row.outcome==='delivered'?'text-green-800':'text-gray-600'}`}>{outcomeLabels[row.outcome]}</span><Link href={`/admin/orders/${row.order_id}`} className="break-all font-mono text-gray-800 underline decoration-gray-300 underline-offset-2">{row.order_number}</Link></div>
          <p className="mt-1 break-words text-gray-600">{row.message}</p>
          {row.code && <p className="mt-1 text-[10px] text-gray-400">오류 코드: {row.code}</p>}
         </li>)}
        </ul>
       </>}
     </div>
    </details>)}
   </div>
   </details>
  </div>
 </section>;
}
