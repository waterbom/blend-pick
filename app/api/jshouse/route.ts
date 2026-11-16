import { cookies } from 'next/headers';
import { withApiErrors } from '@/lib/api-errors';
import { stayService as service, guard, owner, body, failure, notifyGuest, notifyOperator } from '@/lib/jshouse-server';
import { StayError } from '@/lib/jshouse-core.cjs';
import { phoneVerifyOn } from '@/lib/sms';
import { isPhoneVerified } from '@/lib/phone-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

// 달력(예약 가능일·요금·공개 설정) + 이 브라우저에서 넣은 진행 중 신청
async function handleGET() {
  try {
    await guard();
    const token = await owner();
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
        // 문자 인증이 켜져 있으면 인증한 번호로만 신청을 받는다 (허위 신청으로 날짜가 막히는 것 방지)
        const phone = typeof input.guestPhone === 'string' ? input.guestPhone.replace(/[^0-9]/g, '') : '';
        if (phoneVerifyOn() && !(await isPhoneVerified((await cookies()).get('phone_verified')?.value || '', phone))) throw new StayError('휴대폰 인증을 완료해 주세요.', 400);
        const result = await service.request(input, token);
        if (result.created) await Promise.allSettled([notifyGuest(result.row, 'requested'), notifyOperator(result.row, 'requested', result.config)]);
        return Response.json(result.booking, noStore);
      }
      case 'lookup':
        return Response.json(await service.lookup(input, token), noStore);
      case 'cancel': {
        const result = await service.guestCancel(input, token);
        if (result.changed) {
          const config = await service.readConfig();
          if (result.row.status === 'cancelled') await Promise.allSettled([notifyGuest(result.row, 'cancelled'), notifyOperator(result.row, 'guest_cancelled', config)]);
          else await notifyOperator(result.row, 'cancel_requested', config);
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

export const GET = withApiErrors('GET /api/jshouse', handleGET);
export const POST = withApiErrors('POST /api/jshouse', handlePOST);
