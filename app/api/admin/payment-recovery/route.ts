import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { currentAdminSite } from "@/lib/admin-site";
import shopPool from "@/lib/db-shop";
import { processPaymentAttempt, PurchaseError } from "@/lib/payment-attempt";
async function site() { const token = (await cookies()).get('admin_token')?.value; return token && await verifyAdminToken(token) ? (await currentAdminSite()).key : null; }
export async function GET() {
    const key = await site();
    if (!key)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { rows } = await shopPool.query(`SELECT provider_order_id,amount,status,last_error,created_at,updated_at
 FROM payment_attempts WHERE site=$1 AND status NOT IN ('completed','failed') ORDER BY created_at LIMIT 100`, [key]);
    return NextResponse.json(rows);
}
export async function POST(req: Request) {
    const key = await site();
    if (!key)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { orderId } = await req.json();
    if (typeof orderId !== 'string')
        return NextResponse.json({ error: '요청을 확인해주세요.' }, { status: 400 });
    const found = await shopPool.query('SELECT payment_key FROM payment_attempts WHERE provider_order_id=$1 AND site=$2', [orderId, key]);
    if (!found.rows.length)
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    try {
        return NextResponse.json(await processPaymentAttempt(found.rows[0].payment_key, key, true));
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : '복구 실패' }, { status: e instanceof PurchaseError ? e.status : 503 });
    }
}
