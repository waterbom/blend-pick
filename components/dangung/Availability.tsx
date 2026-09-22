'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PricingPlan } from './Pricing';

export type DangungCalendar = {
  today: string; version: number;
  config: {
    pricingPlan?: PricingPlan; enabled: boolean; minLeadDays: number; maxNights: number;
    extraGuestFee: number; extraGuestUnit: string; bbqFee: number; monitorFee: number;
    depositPaymentNote: string; depositAmount: number; depositTerms: string; refundTerms: string;
  };
  dates: { day: string; price: number; season: string; available: boolean; occupied: boolean }[];
  paymentReady: boolean; phoneVerify: boolean;
};

const AvailabilityContext = createContext<{
  calendar: DangungCalendar | null; loadError: string;
  refresh: () => Promise<DangungCalendar>;
} | null>(null);

export function DangungAvailabilityProvider({ children }: { children: ReactNode }) {
  const [calendar, setCalendar] = useState<DangungCalendar | null>(null);
  const [loadError, setLoadError] = useState('');
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const response = await fetch('/api/dangung', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error('예약 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
      if (current === request.current) { setCalendar(data); setLoadError(''); }
      return data as DangungCalendar;
    } catch {
      const message = '예약 정보를 불러오지 못했습니다. 다시 시도해 주세요.';
      if (current === request.current) { setCalendar(null); setLoadError(message); }
      throw Error(message);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    return () => { request.current++; };
  }, [refresh]);
  return <AvailabilityContext.Provider value={{ calendar, loadError, refresh }}>{children}</AvailabilityContext.Provider>;
}

export function useDangungAvailability() {
  const value = useContext(AvailabilityContext);
  if (!value) throw Error('DangungAvailabilityProvider is required');
  return value;
}

export function startingPrice(calendar: DangungCalendar | null) {
  if (!calendar?.config.enabled || !calendar.paymentReady) return null;
  const firstDay = new Date(Date.parse(calendar.today) + calendar.config.minLeadDays * 86400000).toISOString().slice(0, 10);
  const prices = calendar.dates.filter(day => day.day >= firstDay && day.available && !day.occupied).map(day => day.price);
  return prices.length ? Math.min(...prices) : null;
}

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export function StayRate({ compact = false }: { compact?: boolean }) {
  const { calendar, loadError } = useDangungAvailability();
  const price = startingPrice(calendar);
  const message = loadError ? '요금을 다시 확인해 주세요' : !calendar ? '요금 확인 중…'
    : !calendar.config.enabled || !calendar.paymentReady ? '예약 오픈 준비 중' : '현재 예약 가능한 날짜가 없습니다';
  return <div className={compact ? 'dgs-dock-rate' : 'dgs-rate-copy'} aria-live="polite">
    <span className="dgs-rate-label">한옥 독채 · 기준 6인 · 1박</span>
    <strong className="dgs-rate-value">{price !== null ? <>{won(price)}<small>부터</small></> : message}</strong>
    {price !== null && <small className="dgs-rate-note">날짜별 요금 상이 · 추가 인원·옵션·보증금 별도</small>}
  </div>;
}

export function StayFees({ compact = false }: { compact?: boolean }) {
  const { calendar } = useDangungAvailability();
  if (!calendar) return <p className="dgs-fee-note">추가 인원·옵션·별도 보증금은 최신 요금 확인 후 안내합니다.</p>;
  const c = calendar.config;
  if (compact) return <p className="dgs-fee-note">6인 초과 1인 {won(c.extraGuestFee)} / {c.extraGuestUnit === 'perNight' ? '1박' : '예약'} · 침구 포함<br/>시설 보증금 {won(c.depositAmount)} · 계좌이체 별도 납부</p>;
  return <dl className="dgs-fees">
    <div><dt>추가 인원 <small>6인 초과 · 침구 포함</small></dt><dd>{won(c.extraGuestFee)}<small>1인 / {c.extraGuestUnit === 'perNight' ? '1박' : '예약'}</small></dd></div>
    <div><dt>바비큐 세팅 <small>6인 기준 · 선택 옵션 · 예약당 1회</small></dt><dd>{won(c.bbqFee)}</dd></div>
    <div><dt>64인치 모니터 <small>선택 옵션 · 예약당 1회</small></dt><dd>{won(c.monitorFee)}</dd></div>
    <div><dt>시설 보증금 <small>숙박 결제금액에 미포함</small></dt><dd>{won(c.depositAmount)}<small>계좌이체 별도 납부</small></dd></div>
  </dl>;
}
