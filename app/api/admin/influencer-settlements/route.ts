import { withApiErrors } from '@/lib/api-errors';
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { influencerFinance } from "@/lib/influencer-finance";
async function handleGET() {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !await verifyAdminToken(token))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await influencerFinance((await currentAdminSite()).key));
}

export const GET = withApiErrors('GET /api/admin/influencer-settlements', handleGET);
