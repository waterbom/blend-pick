import { cookies } from 'next/headers';
import { withApiErrors } from '@/lib/api-errors';
import { stayService as service, guard, owner, body, failure, notifyGuest, notifyOperator, notifyPayment } from '@/lib/limen-server';
import { StayError } from '@/lib/limen-core.cjs';
import { phoneVerifyOn } from '@/lib/sms';
import { isPhoneVerified } from '@/lib/phone-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

// 결제 응답에서 화면에 필요한 값만 내보낸다
type PaymentResult = { booking: unknown; orderId: string; amount: number | null; payable: boolean };
const paymentView = (r: PaymentResult) => ({ booking: r.booking, orderId: r.orderId, amount: r.amount, payable: r.payable });
// 문자 인증이 켜져 있으면 인증한 번호로만 받는다 (허위 신청으로 날짜가 막히는 것 방지)
async function requireVerifiedPhone(raw: unknown) {
  const phone = typeof raw === 'string' ? raw.replace(/[^0-9]/g, '') : '';
  if (phoneVerifyOn() && !(await isPhoneVerified((await cookies()).get('phone_verified')?.value || '', phone))) throw new StayError('휴대폰 인증을 완료해 주세요.', 400);
}

// 달력(예약 가능일·요금·공개 설정·카드 결제 여부) + 이 브라우저에서 넣은 진행 중 예약.
// ?order=주문번호 → 결제 결과 화면용 예약 상태 (결제를 시작한 브라우저에서만)
async function handleGET(request: Request) {
  try {
    await guard();
    const token = await owner();
    const order = new URL(request.url).searchParams.get('order');
    if (order) {
      if (!token) throw new StayError('이 브라우저에서 진행한 예약을 찾을 수 없어요. 예약번호와 휴대폰 번호로 조회해 주세요.', 404);
      return Response.json(paymentView(await service.status(order, token)), noStore);
    }
    const [calendar, mine] = await Promise.all([service.calendar(), token ? service.mine(token) : []]);
    return Response.json({ ...calendar, mine, phoneVerify: phoneVerifyOn() }, noStore);
  } catch (e) {
    return failure(e);
  }
}

async function handlePOST(request: Request) {
  try {
    await guard(request);
    const input = await body(request), token = (await owner(true))!;
    switch (input.action) {
      case 'request': {
        await requireVerifiedPhone(input.guestPhone);
        const result = await service.request(input, token);
        if (result.created) await Promise.allSettled([notifyGuest(result.row, 'requested'), notifyOperator(result.row, 'requested', result.config)]);
        return Response.json(result.booking, noStore);
      }
      // ── 카드 결제: 날짜 잡기 → (결제창) → 승인 / 포기 / 상태 다시 확인
      case 'reserve': {
        await requireVerifiedPhone(input.guestPhone);
        return Response.json(paymentView(await service.reserve(input, token)), noStore);
      }
      case 'confirm': {
        const result = await service.confirm({ orderId: input.orderId, paymentKey: input.paymentKey, amount: input.amount });
        await notifyPayment(result);
        return Response.json(paymentView(result), noStore);
      }
      case 'reconcile': {
        const result = await service.reconcile(input.orderId, token);
        await notifyPayment(result);
        return Response.json(paymentView(result), noStore);
      }
      case 'abandon':
        return Response.json(paymentView(await service.abandon(input.orderId, token)), noStore);
      case 'lookup': {
        const result = await service.lookup(input, token);
        if (result.changed) await notifyPayment(result);
        return Response.json(result.booking, noStore);
      }
      case 'cancel': {
        const result = await service.guestCancel(input, token);
        if (result.changed) {
          const config = await service.readConfig();
          if (result.row.status === 'cancelled') await Promise.allSettled([notifyGuest(result.row, 'cancelled'), notifyOperator(result.row, 'guest_cancelled', config)]);
          else if (result.row.status === 'confirmed' && result.row.cancel_requested) await notifyOperator(result.row, 'cancel_requested', config);
        }
        return Response.json(result.booking, noStore);
      }
      default:
        throw new StayError('잘못된 요청입니다.', 400);
    }
  } catch (e) {
    return failure(e);
  }
}

export const GET = withApiErrors('GET /api/limen', handleGET);
export const POST = withApiErrors('POST /api/limen', handlePOST);
