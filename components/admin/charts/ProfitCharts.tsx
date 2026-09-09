import MetricChart from '@/components/admin/charts/MetricChart';
type ProfitRow={label:string;channel:string;orders:number;gross:number;net_profit:number|null;sales_vat:number;supply_cost:number;shipping_cost:number;pg_fee:number;other_costs:number;commission:number};
export default function ProfitCharts({rows}:{rows:ProfitRow[]}) {
  if(!rows.length)return null;
  const sum=(key:Exclude<keyof ProfitRow,'label'|'channel'|'net_profit'>)=>rows.reduce((n,r)=>n+r[key],0);
  const top=[...rows].sort((a,b)=>b.gross-a.gross).slice(0,8);
  const rest=rows.filter(r=>!top.includes(r));
  const points=top.map(r=>({label:r.label,values:[r.gross,r.net_profit]}));
  if(rest.length)points.push({label:`나머지 ${rest.length}개`,values:[rest.reduce((s,r)=>s+r.gross,0),rest.some(r=>r.net_profit===null)?null:rest.reduce((s,r)=>s+r.net_profit!,0)]});
  return <div className="mb-6 grid gap-4 xl:grid-cols-2">
    <MetricChart title="공구·채널별 상품 매출과 순이익" description="아래 표와 같은 조회 조건 · 배송비 제외 상품 매출 · 상위 8개와 나머지 합계 · 미확정 순이익은 빈 값" points={points} series={[{label:'상품 매출',color:'#3876a4'},{label:'순이익',color:'#315e43'}]} kind="bar" unit="won"/>
    <MetricChart title="비용 항목별 비교" description="조회된 공구의 비용 합계 · 예상 PG수수료와 공구 단위 비용 포함" points={[{label:'부가세',values:[sum('sales_vat')]},{label:'공급가',values:[sum('supply_cost')]},{label:'배송비',values:[sum('shipping_cost')]},{label:'PG수수료',values:[sum('pg_fee')]},{label:'기타비용',values:[sum('other_costs')]},{label:'인플루언서',values:[sum('commission')]}]} series={[{label:'비용',color:'#b87a28'}]} kind="bar" unit="won"/>
  </div>;
}
