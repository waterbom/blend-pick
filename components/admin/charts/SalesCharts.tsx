import MetricChart from '@/components/admin/charts/MetricChart';
import type { SalesSummary } from '@/lib/sales-statistics';
export default function SalesCharts({data}:{data:SalesSummary}) {
  return <section className="my-6 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">매출 흐름</h2><p className="mt-1 text-xs text-stone-500">{data.from} ~ {data.to} · 한국시간 결제일 기준 · 배송비 포함 · 테스트·미결제 제외</p></div><nav aria-label="매출 통계 기간" className="flex gap-1">{[1,7,30].map(d=><a key={d} href={`?days=${d}`} aria-current={data.days===d?'page':undefined} className={`rounded-lg border px-3 py-2 text-xs ${data.days===d?'bg-emerald-900 text-white':'bg-white'}`}>{d===1?'오늘':`최근 ${d}일`}</a>)}</nav></div>
    {data.totals.unresolved>0&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">환불 대조가 필요한 주문 {data.totals.unresolved}건이 있습니다. 해당 날짜·채널의 순 결제액은 미확정으로 표시합니다.</p>}
    <div className="grid gap-4 xl:grid-cols-2">
      <MetricChart title="일별 결제액·환불액" description="선택 기간 주문의 환불을 현재까지 반영합니다. 환불 발생일 기준 현금 흐름과 다릅니다." points={data.daily.map(d=>({label:d.label.slice(5),values:[d.gross,d.refunds,d.net]}))} series={[{label:'총 결제액',color:'#3876a4'},{label:'확인된 환불액',color:'#bb513b'},{label:'순 결제액',color:'#315e43'}]} unit="won"/>
      <MetricChart title="일별 결제 건수" points={data.daily.map(d=>({label:d.label.slice(5),values:[d.orders]}))} series={[{label:'결제 건수',color:'#315e43'}]} kind="bar"/>
    </div>
    <div className="flex flex-wrap gap-4 text-sm text-emerald-800"><a href="/admin/link-sales" className="underline">전시·비전시 판매 비교 →</a><a href="/admin/profit" className="underline">공구별 손익·비용 →</a><a href="/admin/settlements" className="underline">정산 추이 →</a></div>
  </section>;
}
