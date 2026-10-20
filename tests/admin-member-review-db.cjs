// Real SQL against an isolated in-memory database; production DB/auth/network are blocked.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./support/load.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
let site = 'blendpick', authorized = true, queries = 0;
const pool = { async query(sql, params) { queries++; const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; } };
const mocks = {
  '@/lib/db': pool, '@/lib/db-shop': pool,
  '@/lib/admin-site': { currentAdminSite: async () => { assert.ok(authorized); return { key: site }; } },
  '@/lib/auth': { verifyAdminToken: async () => authorized ? { id: 'fixture-admin' } : null },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'isolated-token' }) }) },
};
const members = load('app/api/admin/members/route.ts', mocks);
const reviews = load('app/api/admin/reviews/route.ts', mocks);
const request = (body, method = 'PATCH', search = '') => new Request(`https://test.invalid/api/admin/fixture${search}`, {
  method: body === undefined ? 'GET' : method,
  ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
});
const patchMember = body => members.PATCH(request({ id: id(1), ...body }));
async function failure(response, status, code) {
  assert.equal(response.status, status);
  const data = await response.json();
  assert.equal(data.ok, false); assert.equal(data.code, code);
  assert.match(data.requestId, /^[a-f0-9-]{36}$/); assert.ok(data.action);
}
before(async () => {
  await db.exec(`
    CREATE TABLE shop_users (id uuid PRIMARY KEY, name text, nickname text, email text, role text,
      role_status text, is_active boolean, profile_image text, kakao_id text,
      created_at timestamptz DEFAULT NOW(), updated_at timestamptz);
    CREATE TABLE orders (id uuid PRIMARY KEY, site text, user_id text, status text,
      total_amount int, paid_at timestamptz DEFAULT NOW());
    CREATE TABLE order_returns (id uuid PRIMARY KEY, order_id uuid REFERENCES orders(id));
    CREATE TABLE products_shop (id uuid PRIMARY KEY, name text, product_code text);
    CREATE TABLE reviews (id uuid PRIMARY KEY, order_id uuid REFERENCES orders(id), product_id uuid,
      buyer_name text, rating int, content text, images text[], is_hidden boolean DEFAULT false,
      created_at timestamptz DEFAULT NOW());
  `);
});
beforeEach(async t => {
  t.mock.method(global, 'fetch', () => { throw Error('External requests forbidden'); });
  t.mock.method(console, 'warn', () => {});
  site = 'blendpick'; authorized = true;
  await db.exec(`TRUNCATE reviews, order_returns, orders, products_shop, shop_users;
    INSERT INTO shop_users(id,name,email,role,role_status,is_active) VALUES
      ('${id(1)}','공통 회원','fixture@example.invalid','influencer','pending',true),
      ('${id(2)}','벤더 회원','vendor@example.invalid','vendor','approved',false);
    INSERT INTO orders(id,site,user_id,status,total_amount) VALUES
      ('${id(10)}','blendpick','${id(1)}','paid',11000),
      ('${id(20)}','sanjipick','${id(1)}','paid',22000);
    INSERT INTO order_returns(id,order_id) VALUES ('${id(30)}','${id(10)}');
    INSERT INTO products_shop(id,name,product_code) VALUES ('${id(40)}','점검 상품','FIXTURE');
    INSERT INTO reviews(id,order_id,product_id,buyer_name,rating,content) VALUES
      ('${id(50)}','${id(10)}','${id(40)}','공통 회원',5,'블랜드픽 후기'),
      ('${id(60)}','${id(20)}','${id(40)}','공통 회원',3,'산지픽 후기');`);
  queries = 0;
});
after(async () => { await db.close(); });

test('member/review reads and writes reject expired admin authentication before any query', async () => {
  authorized = false;
  for (const [route, method] of [[members, 'GET'], [members, 'PATCH'], [reviews, 'GET'], [reviews, 'PATCH'], [reviews, 'DELETE']]) {
    await failure(await route[method](request(method === 'GET' ? undefined : { id: id(1), action: 'approve', is_hidden: true }, method)), 401, 'AUTH_REQUIRED');
  }
  assert.equal(queries, 0);
});
for (const brand of ['blendpick', 'sanjipick']) {
  test(`${brand}: common members retain site-specific purchase/return totals and intersected search`, async () => {
    site = brand;
    const data = await (await members.GET(request(undefined, 'GET', '?q=공통&role=influencer&status=active&pending=1'))).json();
    assert.equal(data.members.length, 1); assert.equal(data.members[0].id, id(1));
    assert.equal(data.members[0].orders, 1);
    assert.equal(data.members[0].spent, brand === 'blendpick' ? 11000 : 22000);
    assert.equal(data.members[0].returns, brand === 'blendpick' ? 1 : 0);
    assert.equal(data.summary.total, 2); assert.equal(data.summary.pending, 1); assert.equal(data.summary.buyers30, 1);
    const empty = await (await members.GET(request(undefined, 'GET', '?q=공통&status=inactive'))).json();
    assert.deepEqual(empty.members, []); assert.equal(empty.summary.total, 2);
  });
  test(`${brand}: review visibility and deletion stay scoped and stale actions fail visibly`, async () => {
    site = brand; const own = id(brand === 'blendpick' ? 50 : 60), foreign = id(brand === 'blendpick' ? 60 : 50);
    const rows = await (await reviews.GET()).json(); assert.deepEqual(rows.map(r => r.id), [own]);
    for (const is_hidden of [true, false]) {
      const result = await reviews.PATCH(request({ id: own, is_hidden }));
      assert.equal(result.status, 200); assert.equal((await result.json()).updated, 1);
      assert.equal((await db.query('SELECT is_hidden FROM reviews WHERE id=$1', [own])).rows[0].is_hidden, is_hidden);
    }
    await failure(await reviews.PATCH(request({ id: foreign, is_hidden: true })), 404, 'NOT_FOUND');
    await failure(await reviews.DELETE(request({ id: foreign }, 'DELETE')), 404, 'NOT_FOUND');
    assert.equal((await db.query('SELECT is_hidden FROM reviews WHERE id=$1', [foreign])).rows[0].is_hidden, false);
    assert.equal((await reviews.DELETE(request({ id: own }, 'DELETE'))).status, 200);
    await failure(await reviews.DELETE(request({ id: own }, 'DELETE')), 404, 'NOT_FOUND');
    await failure(await reviews.PATCH(request({ id: own, is_hidden: true })), 404, 'NOT_FOUND');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM reviews')).rows[0].n, 1);
  });
}
for (const action of ['approve', 'reject']) {
  test(`member ${action} changes a pending application once and reports stale decisions`, async () => {
    assert.equal((await patchMember({ action })).status, 200);
    await failure(await patchMember({ action: action === 'approve' ? 'reject' : 'approve' }), 409, 'STATE_CONFLICT');
    assert.equal((await db.query('SELECT role_status FROM shop_users WHERE id=$1', [id(1)])).rows[0].role_status, action === 'approve' ? 'approved' : 'rejected');
  });
}
test('member activation and role updates persist across the shared account directory', async () => {
  for (const [action, active] of [['deactivate', false], ['activate', true]]) {
    assert.equal((await patchMember({ action })).status, 200);
    assert.equal((await db.query('SELECT is_active FROM shop_users WHERE id=$1', [id(1)])).rows[0].is_active, active);
  }
  for (const role of ['vendor', 'customer', 'influencer']) {
    assert.equal((await patchMember({ action: 'set_role', role })).status, 200);
    site = site === 'blendpick' ? 'sanjipick' : 'blendpick';
    const data = await (await members.GET(request(undefined, 'GET', '?q=공통'))).json();
    assert.equal(data.members[0].role, role); assert.equal(data.members[0].role_status, role === 'customer' ? null : 'approved');
  }
});
for (const action of ['activate', 'deactivate', 'set_role']) {
  test(`member ${action} cannot report success for a missing account`, async () => {
    await failure(await patchMember({ id: id(999), action, role: 'vendor' }), 404, 'NOT_FOUND');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM shop_users')).rows[0].n, 2);
  });
}
test('invalid member role and review visibility are rejected without writes', async () => {
  await failure(await patchMember({ action: 'set_role', role: 'admin' }), 400, 'INVALID_INPUT');
  await failure(await reviews.PATCH(request({ id: id(50), is_hidden: 'true' })), 400, 'INVALID_INPUT');
  assert.equal(queries, 0);
});
