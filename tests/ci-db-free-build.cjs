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
function pages(t, fail = false) {
  const calls = [];
  const cause = Object.assign(new Error('isolated connection failure'), { code: 'ECONNREFUSED' });
  const bailout = Object.assign(new Error('prerender bailout'), { digest: 'DYNAMIC_SERVER_USAGE' });
  const db = name => ({ query: async sql => {
    calls.push(name);
    if (fail) throw cause;
    return { rows: sql.includes('COUNT(*)') ? [{ count: '0' }] : [] };
  } });
  const mocks = {
    '@/lib/db': db('catalog'), '@/lib/db-shop': db('shop'),
    'next/server': { connection: async () => { throw bailout; } },
  };
  for (const name of ['Header', 'PartnersHeader', 'ShopHeroBanner', 'HotelPromoBand', 'FallbackImg']) {
    mocks[`@/components/${name}`] = () => null;
  }
  const info = t.mock.method(console, 'info', () => {});
  const error = t.mock.method(console, 'error', () => {});
  return { calls, cause, bailout, info, error,
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
    await p.home();
    await p.picked();
    assert.equal(p.calls.filter(x => x === 'shop').length, 3);
    assert.equal(p.calls.filter(x => x === 'catalog').length, 4);
    assert.equal(p.info.mock.callCount(), 0);
    const logs = p.error.mock.calls.map(call => call.arguments);
    for (const label of ['[home] 판매 상품 조회 실패:', '[home] 오픈 예정 조회 실패:', '[best-sellers] 판매량 집계 실패:']) {
      assert.ok(logs.some(args => args[0] === label && args[1] === p.cause));
    }
    assert.ok(logs.some(args => args[0] === p.cause));
  });
}

test('runtime keeps successful page rendering and DB queries', async t => {
  environment(t, { NEXT_PHASE: PHASE_PRODUCTION_SERVER });
  const p = pages(t);
  assert.ok(await p.home());
  assert.ok(await p.picked());
  assert.equal(p.calls.length, 7);
  assert.equal(p.error.mock.callCount(), 0);
  assert.equal(p.info.mock.callCount(), 0);
});
