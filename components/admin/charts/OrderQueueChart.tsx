import Link from 'next/link';
import { QUEUE_BUCKETS, queueFilterHref, type QueueSummary } from '@/lib/admin-insights';
export default function OrderQueueChart({data}:{data:QueueSummary|null}) {
  const max=Math.max(1,...(data?.rows.map(r=>r.total)??[]));
  return <section className="overview-panel p-5 my-5" aria-label="주문·배송 체류 현황">
    <div className="overview-section-heading"><div><h2>주문·배송 체류 현황</h2><p>현재 미완료 주문 · 결제 후 경과시간 · 테스트 결제 제외</p></div><strong>{data?data.total.toLocaleString()+'건':'조회 실패'}</strong></div>
    {!data?<p role="alert" className="ops-warning">체류 현황을 불러오지 못했습니다. 새로고침해주세요.</p>:<>
      <p className="text-xs text-gray-500 mb-4">{new Date(data.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 기준 · 막대를 누르면 해당 주문을 확인합니다.</p>
      <div className="space-y-4">{data.rows.map(row=><div key={row.status}>
        <div className="flex justify-between gap-3 text-sm mb-1"><b>{row.label}</b><span>{row.total.toLocaleString()}건</span></div>
        <div className="flex h-8 rounded bg-gray-50 overflow-hidden">{row.values.map((count,i)=>count>0&&<Link prefetch={false} key={QUEUE_BUCKETS[i].key} href={queueFilterHref(row.status,QUEUE_BUCKETS[i].key,data.at)}
          aria-label={row.label+' · '+QUEUE_BUCKETS[i].label+' '+count+'건'} title={QUEUE_BUCKETS[i].label+' '+count+'건'}
          className="flex items-center justify-center text-xs text-white hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:-outline-offset-2"
          style={{width:(count/max*100)+'%',backgroundColor:QUEUE_BUCKETS[i].color}}>{count/max>=.08?count:''}</Link>)}</div>
      </div>)}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs mt-4">{QUEUE_BUCKETS.map(b=><span key={b.key} className="flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{backgroundColor:b.color}}/>{b.label}</span>)}</div>
      <p className="text-xs text-gray-500 mt-3">예약 출고는 모든 본품의 출고 예정일이 아직 남은 주문입니다. 배송 중 경과시간도 결제일부터 계산합니다. 시각 확인은 결제 시각이 없거나 유효하지 않은 주문입니다.</p>
      {!data.total&&<p className="ops-empty">현재 처리 중인 상품 주문이 없습니다.</p>}
      <details className="mt-3 text-xs"><summary className="cursor-pointer underline">구간별 건수와 주문 목록</summary><div className="overflow-x-auto mt-2"><table className="ops-table"><caption className="sr-only">주문 상태별 경과시간 건수</caption><thead><tr><th>상태</th>{QUEUE_BUCKETS.map(b=><th key={b.key}>{b.label}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={row.status}><th>{row.label}</th>{row.values.map((count,i)=><td key={QUEUE_BUCKETS[i].key}><Link className="underline" prefetch={false} href={queueFilterHref(row.status,QUEUE_BUCKETS[i].key,data.at)}>{count}건</Link></td>)}</tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
