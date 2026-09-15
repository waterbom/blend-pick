export type PricingPlan = {
 basePrice: number; weekendSurcharge: number; shoulderSurcharge: number; peakSurcharge: number;
 shoulderRanges: string[][]; peakRanges: string[][];
};
const won=(n:number)=>`${n.toLocaleString('ko-KR')}원`;
const period=(ranges:string[][])=>ranges.map(([a,b])=>a===b?a.replace('-','/'):a.replace('-','/')+'~'+b.replace('-','/')).join(', ');
export default function DangungPricing({plan}:{plan?:PricingPlan}){
 if(!plan)return null;
 return <details className="dg-pricing"><summary>시즌별 숙박 요금 · 1박 / 기준 6인</summary>
 <div className="dg-pricing-scroll"><table><thead><tr><th>시즌</th><th>일~목</th><th>금·토</th></tr></thead><tbody>
 {([['일반',0],['준성수기',plan.shoulderSurcharge],['극성수기',plan.peakSurcharge]] as const).map(([label,extra])=><tr key={label}><th>{label}</th><td>{won(plan.basePrice+extra)}</td><td>{won(plan.basePrice+extra+plan.weekendSurcharge)}</td></tr>)}
 </tbody></table></div>
 <p>준성수기: 매년 {period(plan.shoulderRanges)}</p><p>극성수기: 매년 {period(plan.peakRanges)}</p>
 <p>기간은 시작일과 마지막 날 숙박을 모두 포함합니다. 금·토 추가금은 시즌 추가금과 합산하며, 준성수기와 극성수기 추가금은 중복 적용하지 않습니다.</p>
 <p>추가 인원·선택 옵션과 시설 보증금은 별도입니다. 날짜별 최종 숙박료는 달력과 결제 전 내역에서 확인해 주세요.</p>
 </details>;
}
