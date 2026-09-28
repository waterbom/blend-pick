import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { commitShipmentImport, ShipmentImportError } from '@/lib/admin-shipment-import';

export async function POST(req: Request) {
  const token = (await cookies()).get('admin_token')?.value;
  const admin = token && await verifyAdminToken(token);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await commitShipmentImport((await currentAdminSite()).key, admin, await req.json().catch(() => null)));
  } catch (e) {
    if (!(e instanceof ShipmentImportError)) console.error('Shipment import commit failed');
    return NextResponse.json({ error: e instanceof ShipmentImportError ? e.message : '송장 등록에 실패했습니다. 다시 시도해주세요.' }, { status: e instanceof ShipmentImportError ? e.status : 500 });
  }
}
