'use client';
import {useState} from 'react';
import Link from 'next/link';
import {rankProducts,type ProductInsightRow} from '@/lib/admin-insights';
export default function ProductPerformanceChart({rows,from='',to=''}:{rows:ProductInsightRow[];from?:string;to?:string}) {
  const [metric,setMetric]=useState<'sold'|'gross'|'net'>('sold'),[selected,setSelected]=useState('');
  const ranked=rankProducts(rows,metric),max=Math.max(1,...ranked.map(r=>r[metric]!));
  const product=rows.find(r=>r.id===selected)??ranked[0]??rows[0];
  const options=product?.options??[],optionMax=Math.max(1,...options.map(o=>o.sold)),total=options.reduce((n,o)=>n+o.sold,0);
  const review=!!product?.quantityReview||options.some(o=>o.review>0);
  const uncertain=rows.filter(r=>r[metric]===null);
  const value=(v:number)=>v.toLocaleString('ko-KR')+(metric==='sold'?'개':'원');
  return <section className="border-y border-gray-200 bg-white p-5 my-4" aria-label="상품·옵션 성과 시각화">
    <div className="flex flex-wrap justify-between gap-3 mb-4"><div><h2 className="font-bold text-base">상품·옵션 성과</h2><p className="text-xs text-gray-500 mt-1">{from||'전체 기간'} ~ {to||'현재'} · 결제일 기준 · 현재 조회된 {rows.length}개 상품</p></div>
      <label className="text-xs">순위 기준 <select className="border rounded p-2 ml-1" aria-label="상품 순위 기준" value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="sold">실판매 수량</option><option value="gross">총 결제액</option><option value="net">순 결제액</option></select></label></div>
    <div className="grid gap-8 lg:grid-cols-2">
      <div><h3 className="font-semibold text-sm mb-3">상위 상품 10개</h3>
        {!ranked.length?<p className="text-sm text-gray-500 py-6">확정된 양수 실적이 있는 상품이 없습니다.</p>:<ol className="space-y-3">{ranked.map((row,i)=><li key={row.id}><Link prefetch={false} href={row.href} className="block group"><div className="flex justify-between items-start gap-3 text-xs mb-1"><span className="min-w-0 break-words group-hover:underline">{i+1}. {row.name}</span><b className="shrink-0">{value(row[metric]!)}</b></div><div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded bg-[#3c6549]" style={{width:row[metric]!/max*100+'%'}}/></div></Link></li>)}</ol>}
        {!!uncertain.length&&<details className="text-xs mt-4 text-amber-800"><summary className="cursor-pointer">대조 필요 {uncertain.length}개 상품 · 순위 제외</summary><ul className="mt-2 space-y-1">{uncertain.map(r=><li key={r.id}><Link className="underline" href={r.href}>{r.name}</Link></li>)}</ul></details>}
        <p className="text-xs text-gray-500 mt-4">순 결제액은 확인된 환불을 반영한 금액이며 이익이 아닙니다. 상품명에서 해당 기간의 주문 상세로 이동합니다.</p>
      </div>
      <div><h3 className="font-semibold text-sm mb-3">옵션별 판매 구성</h3>
        <select className="w-full max-w-full border rounded p-2 text-sm mb-3" aria-label="옵션 분석 상품" value={product?.id??''} onChange={e=>setSelected(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
        {review&&<p className="text-xs text-amber-800 mb-3" role="status">수량 대조가 필요한 잠정 실적입니다. 구성비는 확정 후 표시합니다.</p>}
        {!options.length?<p className="text-sm text-gray-500 py-6">선택한 상품의 옵션 판매 기록이 없습니다.</p>:<ul className="space-y-3">{options.map(o=><li key={o.key}><div className="flex justify-between items-start gap-3 text-xs mb-1"><span className="break-words">{o.label}</span><b className="shrink-0">{o.sold.toLocaleString()}개{!review&&total>0?' · '+(o.sold/total*100).toFixed(1)+'%':''}</b></div><div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded bg-[#7396b5]" style={{width:Math.max(0,o.sold)/optionMax*100+'%'}}/></div><p className="text-xs text-gray-500 mt-1">결제 {o.paid} · 취소 {o.cancelled} · 반품 완료 {o.returned}{o.pending?' · 반품 처리 중 '+o.pending:''}{o.review?' · 대조 필요 '+o.review:''}</p></li>)}</ul>}
        <p className="text-xs text-gray-500 mt-4">결제 수량에서 취소·반품 완료 수량을 제외합니다. 처리 중인 반품은 완료 전까지 판매 수량에 포함됩니다.</p>
      </div>
    </div>
  </section>;
}
