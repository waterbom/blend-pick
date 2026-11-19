import { withApiErrors } from '@/lib/api-errors';
import { stayService as service, guard, body, failure, notifyGuest, notifyPayment, paymentReady } from '@/lib/limen-server';
import { REFUND_TERMS } from '@/lib/dangung-policy.cjs';
import { StayError } from '@/lib/limen-core.cjs';
import { smsConfigured } from '@/lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function handleGET() {
  try {
    await guard(undefined, true);
    // refundTemplate: 단궁 예약에 쓰는 승인된 환불 규정 — 운영자가 불러와 고쳐 쓸 수 있게 참고용으로만 내려준다
    return Response.json({ ...(await service.admin()), smsConfigured: smsConfigured(), paymentReady: paymentReady(), refundTemplate: REFUND_TERMS }, noStore);
  } catch (e) {
    return failure(e);
  }
}

async function handlePOST(request: Request) {
  try {
    await guard(request, true);
    const input = await body(request);
    switch (input.action) {
      case 'config':
        return Response.json(await service.saveConfig(input.config), noStore);
      case 'days':
        return Response.json(await service.setDays(input), noStore);
      case 'create':
        return Response.json((await service.adminCreate(input)).booking, noStore);
      case 'decide': {
        const result = await service.decide({ id: input.id, action: input.decision, note: input.note });
        // 손님에게 결과 문자 — 확정·거절·취소가 실제로 바뀐 경우에만
        if (result.changed && input.notify !== false) await notifyGuest(result.row, result.row.status, result.config);
        return Response.json(result.booking, noStore);
      }
      // 카드 결제 예약: 환불 금액을 정해 취소 / 승인·환불 확인 중인 예약을 결제 기록과 다시 맞추기
      case 'refund': {
        const result = await service.refund({ id: input.id, amount: input.amount, reason: input.reason });
        await notifyPayment(result, input.notify !== false);
        return Response.json(result.booking, noStore);
      }
      case 'reconcile': {
        const result = await service.reconcile(input.id);
        await notifyPayment(result);
        return Response.json(result.booking, noStore);
      }
      default:
        throw new StayError('잘못된 요청입니다.', 400);
    }
  } catch (e) {
    return failure(e);
  }
}

export const GET = withApiErrors('GET /api/admin/limen', handleGET);
export const POST = withApiErrors('POST /api/admin/limen', handlePOST);
