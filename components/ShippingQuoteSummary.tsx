import type {ShippingQuote} from '@/lib/use-shipping-quote';
export default function ShippingQuoteSummary({quote,error,retry}:{quote:ShippingQuote|null;error:string;retry:()=>void}){
 if(!quote)return <p role={error?'alert':'status'} className="text-sm text-amber-800">{error||'배송지 선택 후 배송·설치비와 최종 결제금액을 확인합니다.'}{error&&<button type="button" onClick={retry} className="ml-2 underline">다시 확인</button>}</p>;
 return <div className="text-sm space-y-2"><div className="flex justify-between"><span>배송비{quote.bundles>1?` (${quote.bundles}개 배송 묶음)`:''}</span><span>{quote.shippingCost.toLocaleString()}원</span></div>{quote.regionalCost>0&&<p className="text-xs text-gray-500">지정 지역 추가 배송비 {quote.regionalCost.toLocaleString()}원 포함</p>}{quote.installationCost>0&&<div className="flex justify-between"><span>설치비</span><span>{quote.installationCost.toLocaleString()}원</span></div>}</div>;
}
