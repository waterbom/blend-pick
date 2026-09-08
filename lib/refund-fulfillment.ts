export const REFUND_FULFILLMENT_MESSAGE = '환불 처리 중인 주문은 발송·배송 상태와 송장을 변경할 수 없습니다. 환불 결과를 먼저 확인해주세요.';
export function isRefundFulfillmentConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2001';
}
