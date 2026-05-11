export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">대시보드</h1>
      <p className="text-sm text-gray-400 mb-8">Blend Pick 어드민</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">판매 관리</p>
          <p className="text-3xl font-black text-gray-900">0건</p>
          <p className="text-sm text-gray-400 mt-1">신규 주문</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">정산 관리</p>
          <p className="text-3xl font-black text-gray-900">0원</p>
          <p className="text-sm text-gray-400 mt-1">오늘 정산액</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">상품 관리</p>
          <p className="text-3xl font-black text-gray-900">0개</p>
          <p className="text-sm text-gray-400 mt-1">판매중 상품</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">리뷰 현황</p>
          <p className="text-3xl font-black text-gray-900">0개</p>
          <p className="text-sm text-gray-400 mt-1">새 리뷰</p>
        </div>
      </div>
    </div>
  );
}
