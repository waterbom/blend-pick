const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./support/load.cjs');
const { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require('next/constants');

const keys = ['CI', 'CI_DB_FREE_BUILD', 'NEXT_PHASE', 'DATABASE_URL', 'SHOP_DATABASE_URL'];
function environment(t, overrides = {}) {
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { CI: 'true', CI_DB_FREE_BUILD: 'true', NEXT_PHASE: PHASE_PRODUCTION_BUILD }, overrides);
}
function pages(t, fail = false, queryRows) {
  const calls = [];
  const queries = [];
  const cause = Object.assign(new Error('isolated connection failure'), { code: 'ECONNREFUSED' });
  const bailout = Object.assign(new Error('prerender bailout'), { digest: 'DYNAMIC_SERVER_USAGE' });
  const db = name => ({ query: async (sql, params) => {
    calls.push(name);
    queries.push({ name, sql, params });
    if (fail) throw cause;
    if (queryRows) return { rows: queryRows(sql) };
    return { rows: sql.includes('COUNT(*)') ? [{ count: '0' }] : [] };
  } });
  const HomeView = () => null;
  const mocks = {
    '@/lib/db': db('catalog'), '@/lib/db-shop': db('shop'),
    '@/components/blend/BlendHome': HomeView,
    'next/server': { connection: async () => { throw bailout; } },
  };
  for (const name of ['Header', 'PartnersHeader', 'ShopHeroBanner', 'HotelPromoBand', 'FallbackImg']) {
    mocks[`@/components/${name}`] = () => null;
  }
  const info = t.mock.method(console, 'info', () => {});
  const error = t.mock.method(console, 'error', () => {});
  return { calls, queries, cause, bailout, info, error,
    homeProps: rendered => rendered.props.children.find(child => child.type === HomeView).props,
    home: load('app/page.tsx', mocks).default,
    picked: load('app/blend-picked/page.tsx', mocks).default,
  };
}

test('explicit DB-free CI build defers both pages before any DB query or fallback logging', async t => {
  environment(t);
  const p = pages(t, true);
  await assert.rejects(p.home(), e => e === p.bailout);
  await assert.rejects(p.picked(), e => e === p.bailout);
  assert.deepEqual(p.calls, []);
  assert.equal(p.error.mock.callCount(), 0);
  assert.equal(p.info.mock.callCount(), 2);
  assert.match(p.info.mock.calls[0].arguments[0], /ci-db-free-build.*deferring database queries/);
});

for (const [name, overrides] of [
  ['normal production build', { CI_DB_FREE_BUILD: '' }],
  ['non-CI build', { CI: '' }],
  ['production runtime even with leaked opt-in', { NEXT_PHASE: PHASE_PRODUCTION_SERVER }],
  ['runtime without NEXT_PHASE', { NEXT_PHASE: '' }],
  ['configured shop DB', { SHOP_DATABASE_URL: 'postgres://test.invalid/shop' }],
  ['configured catalog DB', { DATABASE_URL: 'postgres://test.invalid/catalog' }],
]) {
  test(`${name} keeps DB calls and original error logs`, async t => {
    environment(t, overrides);
    const p = pages(t, true);
    const rendered = await p.home();
    await p.picked();
    assert.equal(p.calls.filter(x => x === 'shop').length, 4);
    assert.equal(p.calls.filter(x => x === 'catalog').length, 2);
    assert.equal(p.homeProps(rendered).catalogUnavailable, true);
    assert.deepEqual(p.homeProps(rendered).products, []);
    assert.equal(p.info.mock.callCount(), 0);
    const logs = p.error.mock.calls.map(call => call.arguments);
    for (const label of ['[home] 판매 상품 조회 실패:', '[home] 오픈 예정 조회 실패:', '[home] 상품 분류 조회 실패:', '[best-sellers] 판매량 집계 실패:']) {
      assert.ok(logs.some(args => args[0] === label && args[1] === p.cause));
    }
    assert.ok(logs.some(args => args[0] === p.cause));
  });
}

test('runtime keeps successful page rendering and DB queries', async t => {
  environment(t, { NEXT_PHASE: PHASE_PRODUCTION_SERVER });
  const p = pages(t);
  const rendered = await p.home();
  assert.ok(rendered);
  assert.equal(p.homeProps(rendered).catalogUnavailable, false);
  assert.deepEqual(p.homeProps(rendered).products, []);
  assert.ok(await p.picked());
  assert.equal(p.calls.length, 6);
  assert.equal(p.error.mock.callCount(), 0);
  assert.equal(p.info.mock.callCount(), 0);
});

test('homepage passes normalized catalog data while preserving sale and tenant visibility boundaries', async t => {
  environment(t, { NEXT_PHASE: PHASE_PRODUCTION_SERVER });
  const product = {
    id: 'live-product', name: '테스트 상품', brand: null, category: '식품',
    price: '12900', original_price: '15000', stock: '3', status: 'active',
    main_image: '/uploads/product.jpg', shipping_type: 'paid', shipping_cost: '3000',
  };
  const upcoming = { id: 'scheduled-product', name: '오픈 예정 상품', brand: null, main_image: null, open_label: '10. 20' };
  const p = pages(t, false, sql => {
    if (sql.includes('SELECT DISTINCT category')) return [{ category: '식품' }, { category: '리빙' }];
    if (sql.includes('sale_start_at > NOW()')) return [upcoming];
    if (sql.includes('SELECT oi.product_id')) return [{ product_id: product.id }];
    return [product];
  });
  const props = p.homeProps(await p.home());
  assert.deepEqual(props.products, [{ ...product, brand: '', price: 12900, original_price: 15000, stock: 3, shipping_cost: 3000 }]);
  assert.deepEqual(props.upcoming, [{ ...upcoming, brand: '' }]);
  assert.deepEqual(props.categories, ['식품', '리빙']);
  assert.deepEqual(props.topSellerIds, [product.id]);
  assert.equal(props.catalogUnavailable, false);

  const catalogQueries = p.queries.filter(query => query.sql.includes('FROM products_shop'));
  assert.equal(catalogQueries.length, 3);
  for (const { sql, params } of catalogQueries) {
    assert.match(sql, /status = 'active'/);
    assert.match(sql, /is_visible = true/);
    assert.match(sql, /category <> ALL\(\$1::text\[\]\)/);
    assert.deepEqual(params, [['산지픽', '산지픽 농산물', '산지픽 해산물']]);
    if (sql.includes('sale_start_at > NOW()')) continue;
    assert.match(sql, /sale_start_at IS NULL OR sale_start_at <= NOW\(\)/);
    assert.match(sql, /sale_end_at IS NULL OR sale_end_at >= NOW\(\)/);
  }
});
