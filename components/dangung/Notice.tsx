'use client';

import { StayFees, useDangungAvailability } from '@/components/dangung/Availability';
import DangungPolicies from '@/components/dangung/Policies';
import DangungPricing from '@/components/dangung/Pricing';

export default function DangungNotice() {
  const { calendar, loadError } = useDangungAvailability();
  return <>
    <DangungPricing plan={calendar?.config.pricingPlan}/>
    <details className="dgs-details"><summary>추가 인원과 선택 옵션 요금</summary><StayFees/></details>
    {calendar ? <DangungPolicies
      refundTerms={calendar.config.refundTerms || undefined}
      depositTerms={calendar.config.depositTerms || undefined}
      depositPaymentNote={calendar.config.depositPaymentNote || undefined}
      extraGuestFee={calendar.config.extraGuestFee}
      extraGuestUnit={calendar.config.extraGuestUnit}
    /> : <p className="dgs-small" role="status">{loadError || '최신 요금·환불규정·보증금 안내를 불러오고 있습니다.'}</p>}
  </>;
}
