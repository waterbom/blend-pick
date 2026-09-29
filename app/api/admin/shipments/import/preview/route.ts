import { withApiErrors, readJsonObject, reportApiError, apiErrorResponse } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { previewShipmentImport, ShipmentImportError } from '@/lib/admin-shipment-import';

async function handlePOST(req: Request) {
  const token = (await cookies()).get('admin_token')?.value;
  const admin = token && await verifyAdminToken(token);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await previewShipmentImport((await currentAdminSite()).key, admin, await readJsonObject(req)));
  } catch (e) {
    if (!(e instanceof ShipmentImportError)) reportApiError(e, 'app/api/admin/shipments/import/preview/route.ts:14');
    return apiErrorResponse(e, { error: e instanceof ShipmentImportError ? e.message : '송장 미리보기에 실패했습니다. 다시 시도해주세요.' }, { status: e instanceof ShipmentImportError ? e.status : 500 });
  }
}

export const POST = withApiErrors('POST /api/admin/shipments/import/preview', handlePOST);
