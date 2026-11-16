import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import pool from '@/lib/db-shop';
import { verifyAdminToken } from '@/lib/auth';
import { siteFromHost } from '@/lib/sites';
import { sendSMS, smsConfigured } from '@/lib/sms';
import { service, StayError } from '@/lib/jshouse-core.cjs';
import { guestMessage, operatorMessage } from '@/lib/jshouse-messages.cjs';
import { tossPayments, tossReady, TossError } from '@/lib/toss-api';

// JS하우스 예약 API 공통 — 사이트·출처 확인, 브라우저 식별 쿠키, 카드 결제 연동, 문자 알림.
export const JSHOUSE_COOKIE = 'jshouse_guest';
export const paymentReady = tossReady;
// 블랜드픽과 같은 토스 결제 과정: 서버 승인 → 주문 조회(복구) → 취소·환불. 예약마다 고정된 중복 방지 키를 쓴다.
export const stayService = service(pool, {
  payReady: tossReady,
  provider: {
    async confirm(data: { orderId: string; paymentKey: string; amount: number }) {
      try {
        return await tossPayments('/confirm', data, `jshouse-confirm-${data.orderId}`);
      } catch (error) {
        if (error instanceof TossError && error.providerCode === 'ALREADY_PROCESSED_PAYMENT') return tossPayments(`/orders/${encodeURIComponent(data.orderId)}`);
        throw error;
      }
    },
    lookup: (id: string) => tossPayments(`/orders/${encodeURIComponent(id)}`),
    cancel: (paymentKey: string, amount: number, reason: string, id: string) =>
      tossPayments(`/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason: reason, cancelAmount: amount }, `jshouse-cancel-${id}`),
  },
});

// 블랜드픽 도메인에서만 열린다. 쓰기 요청은 같은 출처에서 온 것만 받는다.
export async function guard(request?: Request, admin = false) {
  const h = await headers();
  if (siteFromHost(h.get('host')) !== 'blendpick') throw new StayError('페이지를 찾을 수 없습니다.', 404);
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    let sameOrigin = false;
    try { sameOrigin = !!origin && new URL(origin).host === h.get('host'); } catch { sameOrigin = false; }
    if (!sameOrigin) throw new StayError('잘못된 요청입니다.', 403);
  }
  if (admin) {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !(await verifyAdminToken(token))) throw new StayError('관리자 로그인이 필요합니다.', 401);
  }
}

// 예약 신청자를 구분하는 브라우저 쿠키 (신청 중복 방지·내 신청 보기용)
export async function owner(create = false) {
  const jar = await cookies();
  let token = jar.get(JSHOUSE_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString('hex');
    jar.set(JSHOUSE_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 180 * 86400 });
  }
  return token;
}

export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 16000) throw new StayError('요청 내용이 너무 큽니다.', 413);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('not an object');
    return parsed;
  } catch {
    throw new StayError('잘못된 요청입니다.', 400);
  }
}

// DB 오류 내용은 밖으로 내보내지 않는다
export function failure(error: unknown) {
  const known = error instanceof StayError || error instanceof TossError;
  const status = known ? error.status : 503;
  const message = known ? error.message : '예약 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

type BookingRow = { id: string; guest_phone: string; [key: string]: unknown };
// 문자는 예약 처리와 별개로 최선을 다해 보낸다 — 실패해도 예약은 유지하고 결과만 기록한다.
async function send(row: BookingRow, to: string, text: string, subject: string, kind: string) {
  if (!to || !smsConfigured()) return;
  try {
    const result = await sendSMS(to, text, subject);
    await stayService.note(row.id, result.ok ? 'sms_sent' : 'sms_failed', { kind });
  } catch {
    await stayService.note(row.id, 'sms_failed', { kind }).catch(() => {});
  }
}
export async function notifyGuest(row: BookingRow, kind: 'requested' | 'confirmed' | 'declined' | 'cancelled', config: Record<string, unknown> = {}) {
  await send(row, row.guest_phone, guestMessage(row, kind, config), `JS하우스 ${{ requested: '예약 신청 접수', confirmed: '예약 확정', declined: '예약 안내', cancelled: '예약 취소' }[kind]}`, `guest_${kind}`);
}
export async function notifyOperator(row: BookingRow, kind: 'requested' | 'paid' | 'cancel_requested' | 'guest_cancelled', config: { notifyPhone?: string }) {
  await send(row, config.notifyPhone || '', operatorMessage(row, kind), 'JS하우스 예약 알림', `operator_${kind}`);
}
// 결제 승인·환불로 예약 상태가 실제로 바뀐 경우에만 한 번 알린다
export async function notifyPayment(result: { row: BookingRow; changed: string | null; config?: Record<string, unknown> }, guest = true) {
  const config = result.config || {};
  if (result.changed === 'confirmed') await Promise.allSettled([notifyGuest(result.row, 'confirmed', config), notifyOperator(result.row, 'paid', config)]);
  else if (result.changed === 'cancelled' && guest) await notifyGuest(result.row, 'cancelled', config);
}
