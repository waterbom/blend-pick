import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function update(req: Request, context: {
    params: Promise<{
        id: string;
    }>;
}, legacyDelete = false) {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !await verifyAdminToken(token))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key, { id } = await context.params, b = legacyDelete ? { action: 'hide' } : await req.json();
    if (!uuid(id) || !['hide', 'show', 'merge'].includes(b.action) || b.action === 'merge' && (!uuid(b.target_id) || b.target_id === id))
        return NextResponse.json({ error: '분류와 작업을 확인해주세요.' }, { status: 400 });
    const c = await shopPool.connect();
    try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['categories:' + site]);
        const r = await c.query('SELECT * FROM product_categories WHERE site=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [site, b.action === 'merge' ? [id, b.target_id] : [id]]);
        const src = r.rows.find(x => x.id === id), target = r.rows.find(x => x.id === b.target_id);
        if (!src || b.action === 'merge' && !target) {
            await c.query('ROLLBACK');
            return NextResponse.json({ error: '현재 사이트의 분류가 아닙니다.' }, { status: 404 });
        }
        if (src.merged_into || b.action === 'merge' && (target.hidden || target.merged_into)) {
            await c.query('ROLLBACK');
            return NextResponse.json({ error: '이미 통합되었거나 사용할 수 없는 분류입니다.' }, { status: 409 });
        }
        let count = 0;
        if (b.action === 'merge') {
            if (site === 'sanjipick' && src.name.includes('해산물') !== target.name.includes('해산물')) {
                await c.query('ROLLBACK');
                return NextResponse.json({ error: '농산물과 해산물은 서로 다른 상품 분류입니다.' }, { status: 400 });
            }
            const products = await c.query('SELECT id FROM products_shop WHERE category=$1 AND site=$2 AND archived_at IS NULL FOR UPDATE', [src.name, site]);
            count = products.rows.length;
            if (b.expected_count !== count) {
                await c.query('ROLLBACK');
                return NextResponse.json({ error: '상품 수가 바뀌었습니다. 목록을 새로고침해 다시 확인해주세요.' }, { status: 409 });
            }
            await c.query('UPDATE products_shop SET category=$1,updated_at=NOW() WHERE category=$2 AND site=$3 AND archived_at IS NULL', [target.name, src.name, site]);
            await c.query('UPDATE product_categories SET hidden=true,merged_into=$1 WHERE id=$2', [target.id, id]);
        }
        else
            await c.query('UPDATE product_categories SET hidden=$1 WHERE id=$2', [b.action === 'hide', id]);
        await c.query('INSERT INTO admin_category_events(site,source_id,target_id,action,affected_products) VALUES($1,$2,$3,$4,$5)', [site, id, b.target_id || null, b.action, count]);
        await c.query('COMMIT');
        return NextResponse.json({ ok: true, affected: count });
    }
    catch {
        await c.query('ROLLBACK');
        return NextResponse.json({ error: '분류 변경에 실패했습니다. 기존 분류를 유지합니다.' }, { status: 500 });
    }
    finally {
        c.release();
    }
}
export async function PATCH(req: Request, c: {
    params: Promise<{
        id: string;
    }>;
}) { return update(req, c); }
export async function DELETE(req: Request, c: {
    params: Promise<{
        id: string;
    }>;
}) { return update(req, c, true); }
