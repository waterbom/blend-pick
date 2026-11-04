import Link from 'next/link';
import {returnInsightHref,type ReturnRange,type ReturnSummary} from '@/lib/admin-insights';
export default function ReturnInsights({data,range,error=''}:{data:ReturnSummary|null;range:ReturnRange;error?:string}) {
  const bars=(title:string,rows:{key:string;label:string;count:number;href:string;note?:string}[],color:string)=>{
    const max=Math.max(1,...rows.map(r=>r.count));
    return <div><h3 className="text-sm font-semibold mb-3">{title}</h3><ul className="space-y-3">{rows.map(row=><li key={row.key}><Link prefetch={false} href={row.href} className="block group"><div className="flex justify-between gap-3 text-xs mb-1"><span className="group-hover:underline">{row.label}</span><b>{row.count.toLocaleString()}건</b></div><div className="h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full rounded" style={{width:row.count/max*100+'%',backgroundColor:color}}/></div>{row.note&&<p className="text-xs text-gray-500 mt-1">{row.note}</p>}</Link></li>)}</ul></div>;
  };
  return <section className="ops-list-panel p-5 my-5" aria-label="교환·반품 분석">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-base">교환·반품 분석</h2><p className="text-xs text-gray-500 mt-1">신청일 기준 · 선택 기간 전체 신청 · 테스트 결제 제외</p></div><strong>{data?data.total.toLocaleString()+'건':'조회 실패'}</strong></div>
    <form action="/admin/shipments" className="flex flex-wrap items-end gap-3 my-4 text-xs">
      <label>신청 시작일<input className="block border rounded p-2 mt-1" aria-label="신청 시작일" type="date" name="returnsFrom" defaultValue={range.from}/></label>
      <label>종료일<input className="block border rounded p-2 mt-1" aria-label="신청 종료일" type="date" name="returnsTo" defaultValue={range.to}/></label>
      <label>신청 구분<select className="block border rounded p-2 mt-1" name="returnsKind" defaultValue={range.kind}><option value="all">교환·반품 전체</option><option value="exchange">교환</option><option value="return">반품</option></select></label>
      <button className="ops-button ops-button-primary">분석 조회</button><Link className="underline p-2" href="/admin/shipments?returnsFrom=&returnsTo=&returnsKind=all">전체 기간</Link>
    </form>
    {error?<p className="ops-warning" role="alert">{error}</p>:!data?<p className="ops-warning" role="alert">분석을 불러오지 못했습니다. 새로고침해주세요.</p>:<>
      <p className="text-xs text-gray-500 mb-5">{range.from||'전체 기간'} ~ {range.to||'현재'} · 한국시간 · 그래프를 누르면 아래 신청 목록이 같은 조건으로 표시됩니다.</p>
      {!data.total?<p className="ops-empty">선택한 기간에 신청된 교환·반품이 없습니다.</p>:<div className="grid gap-8 md:grid-cols-3">
        {bars('신청 사유',data.reasons.map(r=>({...r,href:returnInsightHref(range,{reason:r.key}),note:'교환 '+r.exchange+' · 반품 '+r.returns})),'#c59b4c')}
        {bars('현재 처리 상태',data.states.map(s=>({...s,href:returnInsightHref(range,{status:s.key})})),'#7396b5')}
        <div><p className="text-xs text-gray-500 mb-3">완료까지 중앙값 <b className="text-gray-900">{data.medianHours===null?'산출 불가':data.medianHours.toLocaleString('ko-KR',{maximumFractionDigits:1})+'시간'}</b> · 유효 완료 기록 {data.timedCompletions}건</p>{bars('완료 처리 소요시간',data.durations.map(d=>({...d,href:returnInsightHref(range,{duration:d.key})})),'#57836b')}</div>
      </div>}
      <p className="text-xs text-gray-500 mt-5">소요시간은 신청부터 첫 완료 기록까지입니다. 완료 시각이 없으면 계산에서 제외하고 별도 표시합니다. 기본 업무 목록은 기간에 관계없이 진행 중인 신청을 유지합니다.</p>
    </>}
  </section>;
}
