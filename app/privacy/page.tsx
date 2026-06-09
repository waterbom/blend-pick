export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-xs text-gray-400 mb-10">블렌드픽은 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를 보호하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

        <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. 개인정보의 처리 목적</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li><span className="font-medium">회원가입 및 관리:</span> 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 고충처리</li>
              <li><span className="font-medium">재화 또는 서비스 제공:</span> 콘텐츠 제공, 구매 및 결제, 물품 배송</li>
              <li><span className="font-medium">마케팅 및 광고:</span> 이벤트 및 광고성 정보 제공, 서비스 이용 통계</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. 개인정보의 처리 및 보유 기간</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>회원가입 및 관리: 회원탈퇴 시까지</li>
              <li>재화 또는 서비스 제공: 공급완료 및 요금 정산 시까지</li>
              <li>계약·청약철회 기록: 5년 (전자상거래법)</li>
              <li>대금 결제 및 공급 기록: 5년 (전자상거래법)</li>
              <li>소비자 불만·분쟁처리 기록: 3년 (전자상거래법)</li>
              <li>표시·광고 기록: 6개월 (전자상거래법)</li>
              <li>서비스 방문 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. 처리하는 개인정보 항목 및 수집 방법</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium mb-1">일반 회원가입 시</p>
                <p>필수: 아이디, 비밀번호, 이름, 이메일, 휴대전화, 생년월일</p>
                <p>선택: 성별</p>
              </div>
              <div>
                <p className="font-medium mb-1">상품 주문 시</p>
                <p>필수: 주문 정보(이름, 이메일, 휴대전화), 배송 정보(이름, 주소, 휴대전화)</p>
              </div>
              <div>
                <p className="font-medium mb-1">카카오 간편 로그인 시</p>
                <p>필수: 이름 / 선택: 이메일</p>
              </div>
              <div>
                <p className="font-medium mb-1">서비스 이용 과정에서 자동 수집</p>
                <p>서비스 이용기록, 접속로그, 쿠키, 접속 IP 정보, 결제기록</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. 만 14세 미만 아동의 개인정보 처리</h2>
            <p>회사는 만 14세 미만 아동에 대해 개인정보를 수집할 때 법정대리인의 동의를 얻어 최소한의 개인정보를 수집합니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. 개인정보의 제3자 제공</h2>
            <p>회사는 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. 개인정보처리의 위탁</h2>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">수탁업체</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">위탁업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2">토스페이먼츠</td>
                    <td className="px-4 py-2">결제 처리</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">택배사</td>
                    <td className="px-4 py-2">상품 배송</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. 개인정보의 파기</h2>
            <p>개인정보가 불필요하게 되었을 때에는 지체없이 파기합니다. 전자적 파일은 재생할 수 없는 기술적 방법으로, 종이 출력물은 분쇄 또는 소각합니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. 정보주체의 권리·의무 및 행사방법</h2>
            <p>정보주체는 언제든지 개인정보 열람·정정·삭제·처리정지 요구를 할 수 있습니다. 마이페이지의 "개인정보변경" 또는 "회원탈퇴"를 통해 직접 처리하거나, 개인정보 보호책임자에게 연락하시면 지체없이 조치합니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. 개인정보의 안전성 확보조치</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
              <li>기술적 조치: 접근권한 관리, 접근통제시스템, 개인정보 암호화, 보안프로그램 설치</li>
              <li>물리적 조치: 전산실·자료보관실 접근통제</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">10. 쿠키(Cookie) 운영</h2>
            <p>회사는 이용자에게 맞춤 서비스를 제공하기 위해 쿠키를 사용합니다. 브라우저 설정(도구 &gt; 인터넷 옵션 &gt; 개인정보)을 통해 쿠키 저장을 거부할 수 있으나, 일부 서비스 이용에 어려움이 생길 수 있습니다.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">11. 개인정보 보호책임자</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-xs space-y-1">
              <p>이메일: blendpick@blendpunch.com</p>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">12. 권익침해 구제방법</h2>
            <ul className="space-y-1 list-none text-xs">
              <li>개인정보분쟁조정위원회: 1833-6972 (privacy.go.kr)</li>
              <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
              <li>대검찰청: 1301 (www.spo.go.kr)</li>
              <li>경찰청: 182 (ecrm.cyber.go.kr)</li>
            </ul>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">이 개인정보처리방침은 2026년 1월 1일부터 적용됩니다.</p>
        </div>
      </div>
    </main>
  );
}
