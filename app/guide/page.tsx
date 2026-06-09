export default function GuidePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-10">이용안내</h1>

        <div className="space-y-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">회원가입 안내</h2>
            <p className="text-gray-600 mb-3">[회원가입] 메뉴를 통해 이용약관·개인정보보호정책 동의 및 일정 양식의 가입항목을 기입함으로써 회원에 가입되며, 가입 즉시 서비스를 이용하실 수 있습니다.</p>
            <ul className="space-y-1 list-disc list-inside text-gray-600">
              <li>주문 시 정보를 매번 입력하지 않아도 됩니다.</li>
              <li>공구·경매 행사에 항상 참여하실 수 있습니다.</li>
              <li>회원 전용 이벤트 및 할인 행사에 참여하실 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">주문 안내</h2>
            <ol className="space-y-1 list-none text-gray-600">
              <li><span className="font-medium text-gray-900">Step 1</span> — 상품 검색</li>
              <li><span className="font-medium text-gray-900">Step 2</span> — 장바구니에 담기</li>
              <li><span className="font-medium text-gray-900">Step 3</span> — 회원 로그인 또는 비회원 주문</li>
              <li><span className="font-medium text-gray-900">Step 4</span> — 주문서 작성</li>
              <li><span className="font-medium text-gray-900">Step 5</span> — 결제방법 선택 및 결제</li>
              <li><span className="font-medium text-gray-900">Step 6</span> — 주문 완료 (주문번호 확인)</li>
            </ol>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">결제 안내</h2>
            <p className="text-gray-600 mb-2">고액결제의 경우 안전을 위해 카드사에서 확인전화를 드릴 수도 있습니다. 도난 카드의 사용이나 타인 명의 주문 등 비정상 주문으로 판단될 경우 임의로 주문이 보류 또는 취소될 수 있습니다.</p>
            <p className="text-gray-600">무통장 입금은 주문 시 입력한 입금자명과 실제 입금자 성명이 반드시 일치하여야 하며, 7일 이내에 입금하셔야 합니다. 미입금 시 주문이 자동 취소됩니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">배송 안내</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex gap-4">
                <span className="text-gray-400 w-20 shrink-0">배송 방법</span>
                <span>택배</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-20 shrink-0">배송 지역</span>
                <span>전국</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-20 shrink-0">배송 비용</span>
                <span>무료 (주문 금액에 상관없이)</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-400 w-20 shrink-0">배송 기간</span>
                <span>3일 ~ 7일</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">산간벽지나 도서지방은 별도의 추가금액이 발생할 수 있습니다. 입금 확인 후 배송되며, 상품 종류에 따라 일부 지연될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">교환·반품 안내</h2>
            <div className="mb-3">
              <p className="font-medium text-gray-800 mb-1">교환·반품 주소</p>
              <p className="text-gray-600">경기도 안양시 만안구 병목안로 15</p>
            </div>
            <div className="mb-3">
              <p className="font-medium text-gray-800 mb-1">교환·반품이 가능한 경우</p>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>계약내용에 관한 서면을 받은 날부터 7일 이내</li>
                <li>공급받은 재화의 내용이 표시·광고 내용과 다른 경우: 공급받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-1">교환·반품이 불가능한 경우</p>
              <ul className="space-y-1 list-disc list-inside text-gray-600">
                <li>이용자 귀책 사유로 재화가 멸실 또는 훼손된 경우</li>
                <li>이용자의 사용 또는 소비로 재화의 가치가 현저히 감소한 경우</li>
                <li>시간 경과로 재판매가 곤란할 정도로 가치가 감소한 경우</li>
                <li>복제 가능한 재화의 포장을 훼손한 경우</li>
                <li>개별 주문 생산 재화로 청약철회 시 판매자에게 회복 불가 피해가 예상되는 경우</li>
                <li>디지털 콘텐츠의 제공이 개시된 경우</li>
              </ul>
              <p className="text-xs text-gray-400 mt-2">고객 변심에 의한 교환·반품 시 상품 반송 비용은 고객님께서 부담하셔야 합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-3">환불 안내</h2>
            <p className="text-gray-600 mb-1">반품 확인 후 3영업일 이내에 결제 금액을 환불합니다.</p>
            <p className="text-gray-600">신용카드 결제의 경우 신용카드 승인을 취소하여 청구되지 않도록 합니다. (결제일에 따라 익월 청구 후 카드사에서 환급 처리될 수 있습니다.)</p>
          </section>

        </div>
      </div>
    </main>
  );
}
