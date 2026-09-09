import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import shopPool from '@/lib/db-shop';
import { SITES } from '@/lib/sites';
async function admin() { const t = (await cookies()).get('admin_token')?.value; return t ? verifyAdminToken(t) : null; }
export async function GET(req?: Request) {
    if (!await admin())
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key, all = req ? new URL(req.url).searchParams.get('all') === '1' : false;
    const r = await shopPool.query(`SELECT c.id,c.name,c.sort_order,c.hidden,c.merged_into,COUNT(p.id)::int AS product_count FROM product_categories c LEFT JOIN products_shop p ON p.category=c.name AND p.archived_at IS NULL WHERE c.site=$1 AND ($2 OR NOT c.hidden) GROUP BY c.id ORDER BY c.hidden,c.sort_order,c.name`, [site, all]);
    return NextResponse.json(r.rows);
}
export async function POST(req: Request) {
    if (!await admin())
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key, b = await req.json(), name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 100 || SITES.sanjipick.categories.includes(name) !== (site === 'sanjipick'))
        return NextResponse.json({ error: '현재 사이트의 분류명을 100자 이내로 입력해주세요. 산지픽은 농산물·해산물 분류를 사용합니다.' }, { status: 400 });
    const c = await shopPool.connect();
    try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['categories:' + site]);
        const duplicate = await c.query("SELECT id FROM product_categories WHERE site=$1 AND lower(regexp_replace(trim(name),'\\s+',' ','g'))=lower($2)", [site, name]);
        if (duplicate.rows.length) {
            await c.query('ROLLBACK');
            return NextResponse.json({ error: '이미 있는 분류입니다. 숨긴 분류도 확인해주세요.' }, { status: 409 });
        }
        const r = await c.query('INSERT INTO product_categories(name,site) VALUES($1,$2) RETURNING id,name', [name, site]);
        await c.query('COMMIT');
        return NextResponse.json(r.rows[0], { status: 201 });
    }
    catch {
        await c.query('ROLLBACK');
        return NextResponse.json({ error: '분류를 저장하지 못했습니다.' }, { status: 500 });
    }
    finally {
        c.release();
    }
}
