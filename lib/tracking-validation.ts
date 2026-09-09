import { toCarrierCode } from '@/lib/carriers';

export function validTrackingNumber(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length <= 100 && /^\d+(?:-\d+)*$/.test(value.trim());
}

export function validateTracking(carrier: unknown, number: unknown) {
  if (!validTrackingNumber(number)) return { ok: false as const, error: '운송장번호 형식을 확인해주세요. 숫자와 숫자 사이의 하이픈만 사용할 수 있습니다.' };
  const code = typeof carrier === 'string' ? toCarrierCode(carrier.trim()) : null;
  if (!code) return { ok: false as const, error: '택배사 코드가 없거나 형식이 올바르지 않습니다' };
  return { ok: true as const, carrier: code, number: number.trim() };
}
