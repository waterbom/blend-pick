// Operator-approved terms and add-on prices, 2026-09-15.
const REFUND_TERMS = `예약 취소 및 일정 변경 시 아래 환불 기준이 적용됩니다.

• 예약 후 24시간 이내 취소: 전액 환불
  ※ 단, 이용예정일 당일 예약 등 관련 법령 및 소비자분쟁해결기준상 청약철회가 제한되는 경우는 제외될 수 있습니다.
• 이용일 10일 전까지: 전액 환불
• 이용일 7~9일 전: 결제금액의 90% 환불
• 이용일 5~6일 전: 결제금액의 70% 환불
• 이용일 3~4일 전: 결제금액의 50% 환불
• 이용일 1~2일 전: 결제금액의 20% 환불
• 이용일 당일 취소 및 노쇼(No-show): 환불 불가

예약일 변경은 기존 예약의 취소 후 재예약을 원칙으로 하며, 변경 시점에 따른 취소 및 환불 규정이 동일하게 적용될 수 있습니다.

천재지변, 기상특보 등으로 인해 숙소 이용 또는 이동이 객관적으로 불가능한 경우에는 관련 법령 및 소비자분쟁해결기준에 따라 일정 변경 또는 환불을 협의합니다.

숙소 측 사정으로 정상적인 숙박 제공이 불가능하여 예약이 취소되는 경우에는 관련 기준에 따라 결제금액 환불 및 필요한 조치를 진행합니다.`;

const DEPOSIT_TERMS = `시설 및 비품 보호를 위해 예약 건당 시설 보증금 100,000원이 발생합니다.

시설 보증금은 숙박요금과 별도로 관리하며, 퇴실 후 객실 및 시설 확인 결과 이상이 없는 경우 전액 반환됩니다.

시설·비품의 파손 또는 분실, 일반적인 숙박 이용 범위를 벗어난 심각한 오염 등이 발생한 경우 실제 발생한 복구·교체 비용을 기준으로 보증금에서 차감될 수 있습니다.

보증금을 초과하는 손해가 발생한 경우 실제 손해액에 따라 추가 비용이 청구될 수 있습니다.

※ 단순 사용감이나 통상적인 객실 정비 범위에 해당하는 사항에 대해서는 보증금을 차감하지 않습니다.`;

const DEPOSIT_PAYMENT_NOTE = '시설 보증금은 카드 결제금액에 포함되지 않으며 계좌이체로 별도 납부합니다. 입금 계좌는 별도 안내됩니다.';

const APPROVED_SETTINGS = {
  saleTermsRevision: '2026-09-15',
  extraGuestFee: 20000,
  extraGuestUnit: 'perStay',
  bbqFee: 50000,
  monitorFee: 50000,
  depositAmount: 100000,
  depositTerms: DEPOSIT_TERMS,
  depositPaymentNote: DEPOSIT_PAYMENT_NOTE,
  refundTerms: REFUND_TERMS,
  weekendSurcharge: 100000,
  shoulderSurcharge: 100000,
  peakSurcharge: 150000,
};

module.exports = { REFUND_TERMS, DEPOSIT_TERMS, DEPOSIT_PAYMENT_NOTE, APPROVED_SETTINGS };
