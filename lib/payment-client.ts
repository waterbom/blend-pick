export const PAYMENT_CONNECTION_MESSAGE = '결제 처리 결과를 확인하지 못했습니다. 다시 결제하지 말고 주문 내역을 먼저 확인하거나 고객센터에 문의해주세요. (오류 PAYMENT_RESPONSE_UNCERTAIN)';
export function readCheckoutSession(key: string): Record<string, any> | null {
  try {
    const raw = sessionStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
export function clearCheckoutSession(key: string) {
  // A browser storage failure cannot turn an approved payment into a failed one.
  try { sessionStorage.removeItem(key); } catch { /* The server result is authoritative. */ }
}
