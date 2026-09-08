import {currentAdminSite} from "@/lib/admin-site";
import {getLinkSales} from "@/lib/link-sales";
export const dynamic="force-dynamic";
const dateOK=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const won=(v:string)=>Number(v).toLocaleString("ko-KR")+"원";
export default async function LinkSales({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}) {
  const site=await currentAdminSite(); const q=await searchParams;
  const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const from=typeof q.from==="string"&&dateOK(q.from)?q.from:today.slice(0,8)+"01";
  const to=typeof q.to==="string"&&dateOK(q.to)?q.to:today;
  if(from>to) return <p>조회 종료일은 시작일 이후로 설정해주세요.</p>;
  const end=new Date(Date.parse(to+"T00:00:00+09:00")+86400000).toISOString();
  const rows=await getLinkSales(site.key,from+"T00:00:00+09:00",end);
  return <div className="space-y-5">
    <div><a href="/admin/orders" className="text-sm text-gray-500">← 판매 관리</a><h1 className="text-xl font-bold mt-3">{site.name} 전시·비전시 판매 집계</h1></div>
    <form className="flex flex-wrap gap-3 items-end bg-white p-4 border border-gray-200">
      <label className="text-sm">결제 시작일<input name="from" type="date" defaultValue={from} className="block border p-2 mt-1"/></label>
      <label className="text-sm">결제 종료일<input name="to" type="date" defaultValue={to} className="block border p-2 mt-1"/></label>
      <button className="bg-[#2D5A27] text-white px-5 py-2">조회</button>
    </form>
    <p className="text-sm text-gray-500">한국시간 결제일 기준 · 배송비 포함 결제액 · 선택 기간의 주문에 발생한 환불은 현재까지 반영합니다. 테스트 결제와 미결제는 제외합니다.</p>
    <div className="overflow-x-auto bg-white border border-gray-200"><table className="w-full text-sm text-left"><thead><tr>{["구매 구분","결제 건수","주문 수량","총 결제액","확인된 환불액","순 결제액"].map(h=><th key={h} className="p-4 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
      {["display","non_display"].map(channel=>{const r=rows.find(x=>x.sales_channel===channel);return <tr key={channel} className="border-t border-gray-100"><td className="p-4 font-bold">{channel==="display"?"전시":"비전시"}</td><td className="p-4">{r?.orders??0}건</td><td className="p-4">{r?.units??0}개</td><td className="p-4">{won(r?.gross??"0")}</td><td className="p-4">{won(r?.refunds??"0")}</td><td className="p-4">{r?.unresolved ? <span className="text-amber-700">환불 대조 필요 {r.unresolved}건</span>:won(r?.net??"0")}</td></tr>;})}
    </tbody></table></div>
    <p className="text-xs text-gray-500">수량은 최초 주문 수량입니다. 과거 환불액이 기록되지 않았거나 금액 대조가 필요한 주문이 있으면 순 결제액을 확정 표시하지 않습니다. 링크 만료·상품 삭제 후에도 구매 구분은 유지됩니다.</p>
  </div>;
}
