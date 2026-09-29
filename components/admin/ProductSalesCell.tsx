import type { ProductSales } from "@/lib/product-sales";

export default function ProductSalesCell({ sales }: { sales: ProductSales | null }) {
  if (!sales) return <span className="text-xs text-gray-400">집계 불가</span>;
  const n = (value: number) => value.toLocaleString("ko-KR");
  return (
    <div className="min-w-40">
      <p className="font-bold text-[#2D5A27] ds-mono">{n(sales.sold)}개{sales.review > 0 && <span className="ml-1 text-xs text-amber-700">(잠정)</span>}</p>
      <p className="mt-0.5 text-xs text-gray-500">결제 {n(sales.orders)}건 · {n(sales.paid)}개</p>
      {sales.pending > 0 && <p className="mt-1 text-xs text-amber-700">취소·반품 진행 {n(sales.pending)}건</p>}
      {sales.review > 0 && <p className="mt-1 text-xs text-red-600">수량 확인 필요 {n(sales.review)}건</p>}
      {sales.orders > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-gray-600 hover:text-[#2D5A27]">옵션별·집계 내역</summary>
          <div className="mt-2 border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-gray-600">취소 완료 {n(sales.cancelled)}개 · 반품 완료 {n(sales.returned)}개</p>
            <table className="w-full min-w-64 text-left">
              <caption className="sr-only">옵션별 판매 수량</caption>
              <thead><tr className="text-gray-500"><th className="py-1 pr-2">옵션</th><th className="py-1 pr-2">결제</th><th className="py-1 pr-2">취소/반품</th><th className="py-1">판매</th></tr></thead>
              <tbody>{sales.options.map(option => (
                <tr key={option.key} className="border-t border-gray-200">
                  <td className="py-2 pr-2 whitespace-normal">{option.label}</td>
                  <td className="py-2 pr-2 ds-mono">{n(option.paid)}</td>
                  <td className="py-2 pr-2 ds-mono">{n(option.cancelled + option.returned)}</td>
                  <td className="py-2 font-semibold ds-mono">{n(option.sold)}{option.review > 0 ? " (잠정)" : ""}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
