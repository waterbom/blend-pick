import { REFUND_TERMS, DEPOSIT_TERMS, DEPOSIT_PAYMENT_NOTE } from '@/lib/dangung-policy.cjs';

export default function DangungPolicies({
  refundTerms = REFUND_TERMS,
  depositTerms = DEPOSIT_TERMS,
  depositPaymentNote = DEPOSIT_PAYMENT_NOTE,
  extraGuestFee = 20000,
  extraGuestUnit = 'perStay',
}: { refundTerms?: string; depositTerms?: string; depositPaymentNote?: string; extraGuestFee?: number; extraGuestUnit?: string }) {
  return <section className="dg-policies" aria-labelledby="dangung-policies-title">
    <h3 id="dangung-policies-title">예약 전 확인해 주세요</h3>
    <p className="booking-small">36개월 미만 유아는 무료이며 기준·최대 인원에 포함되지 않습니다.<br />
      6인 초과 추가 인원 요금은 침구 포함 1인 {extraGuestFee.toLocaleString('ko-KR')}원이며, {extraGuestUnit==='perNight'?'1박당 부과됩니다.':'숙박 일수와 관계없이 예약당 한 번 부과됩니다.'}</p>
    <details className="dg-terms"><summary>취소 및 환불 규정</summary><p className="dg-preline">{refundTerms}</p></details>
    <details className="dg-terms"><summary>시설 보증금</summary><p className="dg-preline">{depositTerms}</p><p className="dg-preline">{depositPaymentNote}</p></details>
  </section>;
}
