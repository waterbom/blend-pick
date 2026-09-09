import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
import { confirmDispatch, DispatchError } from '@/lib/admin-dispatch';
async function authorized() { const t = (await cookies()).get('admin_token')?.value; return t && await verifyAdminToken(t); }
export async function POST(req: Request) {
    if (!await authorized())
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const b = await req.json();
        return NextResponse.json(await confirmDispatch((await currentAdminSite()).key, b.request_key, b.orderIds));
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof DispatchError ? e.message : '발주 결과를 확인하지 못했습니다. 이력에서 확인 후 같은 요청으로 다시 시도해주세요.' }, { status: e instanceof DispatchError ? e.status : 500 });
    }
}
export async function GET(req: Request) {
    if (!await authorized())
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key, id = new URL(req.url).searchParams.get('id');
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const r = id ? await shopPool.query('SELECT id,snapshot,created_at FROM admin_dispatch_batches WHERE site=$1 AND id=$2', [site, id]) : await shopPool.query('SELECT id,request_key,created_at,cardinality(order_ids) AS order_count FROM admin_dispatch_batches WHERE site=$1 ORDER BY created_at DESC LIMIT 10', [site]);
    return id ? NextResponse.json(r.rows[0] ?? { error: '이력을 찾을 수 없습니다.' }, { status: r.rows.length ? 200 : 404 }) : NextResponse.json(r.rows);
}
