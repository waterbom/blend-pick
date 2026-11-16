import { withApiErrors } from '@/lib/api-errors';
import { stayService as service, guard, body, failure, notifyGuest } from '@/lib/jshouse-server';
import { StayError } from '@/lib/jshouse-core.cjs';
import { smsConfigured } from '@/lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

async function handleGET() {
  try {
    await guard(undefined, true);
    return Response.json({ ...(await service.admin()), smsConfigured: smsConfigured() }, noStore);
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
      default:
        throw new StayError('잘못된 요청입니다.', 400);
    }
  } catch (e) {
    return failure(e);
  }
}

export const GET = withApiErrors('GET /api/admin/jshouse', handleGET);
export const POST = withApiErrors('POST /api/admin/jshouse', handlePOST);
