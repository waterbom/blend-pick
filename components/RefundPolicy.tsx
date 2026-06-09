export default function RefundPolicy() {
  return (
    <div className="mt-12 border-t border-gray-100 pt-8 text-sm text-gray-600">
      <h2 className="text-base font-semibold text-gray-900 mb-5">배송 · 교환 · 환불 안내</h2>

      <div className="space-y-5">
        <div>
          <p className="font-medium text-gray-800 mb-1.5">배송</p>
          <ul className="space-y-0.5 text-gray-500 text-xs leading-relaxed">
            <li>배송 방법: 택배 · 배송 지역: 전국 · 배송비: 무료</li>
            <li>배송 기간: 결제 확인 후 3~7일 이내 출고</li>
            <li>산간·도서 지방은 추가 배송비가 발생할 수 있습니다.</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-gray-800 mb-1.5">교환·반품</p>
          <ul className="space-y-0.5 text-gray-500 text-xs leading-relaxed">
            <li>반품 주소: 경기도 안양시 만안구 병목안로 15</li>
            <li>재화 수령일부터 7일 이내 청약철회 가능</li>
            <li>표시·광고와 다른 경우: 수령일부터 3개월 또는 사실을 안 날부터 30일 이내</li>
            <li>고객 변심에 의한 반품 시 반송 비용은 고객 부담</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-gray-800 mb-1.5">교환·반품 불가 사유</p>
          <ul className="space-y-0.5 text-gray-500 text-xs leading-relaxed">
            <li>고객 귀책으로 재화가 훼손·멸실된 경우</li>
            <li>사용·소비로 재화의 가치가 현저히 감소한 경우</li>
            <li>시간 경과로 재판매가 곤란한 경우</li>
            <li>복제 가능한 재화의 포장을 훼손한 경우</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-gray-800 mb-1.5">환불</p>
          <ul className="space-y-0.5 text-gray-500 text-xs leading-relaxed">
            <li>반품 확인 후 3영업일 이내 환불 처리</li>
            <li>신용카드 결제는 카드 승인 취소로 처리 (일부 익월 정산될 수 있음)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
