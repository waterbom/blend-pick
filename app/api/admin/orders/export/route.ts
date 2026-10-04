import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { currentOrderListExport } from '@/lib/admin-dispatch';
import { withApiErrors, readJsonObject, ApiError } from '@/lib/api-errors';

async function handlePOST(req: Request) {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !await verifyAdminToken(token)) throw new ApiError('AUTH_REQUIRED');
    const { orderIds } = await readJsonObject(req);
    const orders = await currentOrderListExport((await currentAdminSite()).key, orderIds);
    return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = withApiErrors('POST /api/admin/orders/export', handlePOST);
