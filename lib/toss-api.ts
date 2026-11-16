// 토스페이먼츠 결제 API 호출 — 블랜드픽이 쓰는 것과 같은 실결제 키(TOSS_CLIENT_KEY / TOSS_SECRET_KEY)를 쓴다.
// 호출하는 쪽에서 중복 방지 키(Idempotency-Key)를 넘기면 같은 요청을 다시 보내도 한 번만 처리된다.
export class TossError extends Error {
  status: number;
  providerCode?: string; // 토스가 응답으로 알려준 오류 코드 (응답을 받지 못한 경우에는 없음)
  constructor(message: string, status = 503, providerCode?: string) {
    super(message);
    this.status = status;
    this.providerCode = providerCode;
  }
}

// 실결제 키가 둘 다 있어야 결제를 연다 (테스트 키로는 열지 않는다)
export function tossReady() {
  const client = process.env.TOSS_CLIENT_KEY || '', secret = process.env.TOSS_SECRET_KEY || '';
  return client.startsWith('live_ck_') && secret.startsWith('live_sk_');
}

// 토스 결제 객체(Payment) — 예약 원장이 status·orderId·totalAmount·paymentKey·receipt·cancels 를 읽는다
export type TossPayment = Record<string, unknown>;

export async function tossPayments(path: string, body?: object, idempotencyKey?: string): Promise<TossPayment> {
  if (!tossReady()) throw new TossError('결제를 준비 중입니다.', 503);
  let response: Response;
  try {
    response = await fetch(`https://api.tosspayments.com/v1/payments${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // 응답을 받지 못함 — 승인됐을 수도 있으므로 다시 결제하지 않게 안내한다
    throw new TossError('결제 상태를 확인하고 있어요. 다시 결제하지 마시고 ‘결제 상태 다시 확인’을 눌러 주세요.', 503);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new TossError('결제 상태를 확인하지 못했어요. 다시 결제하지 마시고 ‘결제 상태 다시 확인’을 누르거나 예약번호로 문의해 주세요.', 503,
      typeof result.code === 'string' ? result.code : 'UNKNOWN');
  }
  return result;
}
