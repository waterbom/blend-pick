// Run without a Next production build or database: node tests/sanjipick-mypage.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}, cache = new Map()) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const mod = { exports: {} };
  cache.set(full, mod);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: full,
  }).outputText;
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === '@/lib/db' || name === '@/lib/db-shop') throw Error('Database access must be mocked');
    if (name.startsWith('@/')) {
      const rel = name.slice(2);
      const resolved = ['.ts', '.tsx'].map(ext => rel + ext).find(f => fs.existsSync(path.join(root, f)));
      return load(resolved, mocks, cache);
    }
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(localRequire, mod, mod.exports);
  return mod.exports;
}
const sites = load('lib/sites.ts');
const cookies = { cookies: async () => ({ get: name => ({ value: name === 'shop_token' ? 'token' : 'verified' }) }) };
const auth = { verifyToken: async () => ({ id: 'user-1', role: 'influencer' }) };
const link = ({ children, ...props }) => React.createElement('a', props, children);
const redirect = dest => { throw Error(`REDIRECT:${dest}`); };
const baseMocks = {
  'next/headers': cookies,
  'next/navigation': { redirect, useRouter: () => ({ refresh() {}, push() {} }) },
  'next/link': link,
  '@/lib/auth': auth,
  '@/components/Header': () => React.createElement('header', null, '산지픽'),
  '@/components/CancelOrderButton': () => React.createElement('button', null, '주문 취소'),
  '@/components/WithdrawButton': () => null,
  '@/lib/phone-verify': { isPhoneVerified: async () => true, verifiedPhoneOf: async () => '01012345678', normPhone: p => p.replace(/\D/g, '') },
};
let count = 0;
async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
function request(url, cookie) {
  return new NextRequest(url, { headers: { host: new URL(url).host, 'x-site': 'spoofed', ...(cookie ? { cookie } : {}) } });
}

(async () => {
  const { proxy } = load('proxy.ts');
  for (const route of ['/mypage', '/mypage/returns/new?order=1', '/mypage/reviews/new?product=1']) {
    await test(`sanji host rewrites ${route}`, () => {
      const res = proxy(request(`https://sanjipick.blendpunch.com${route}`));
      assert.equal(res.headers.get('x-middleware-rewrite'), `https://sanjipick.blendpunch.com/sanji${route}`);
      assert.equal(res.headers.get('x-middleware-request-x-site'), 'sanjipick');
    });
  }
  await test('shop and sanji preview resolve independently', () => {
    const shop = proxy(request('https://shop.blendpunch.com/mypage'));
    assert.equal(shop.headers.get('x-middleware-rewrite'), null);
    assert.equal(shop.headers.get('x-middleware-request-x-site'), 'blendpick');
    const preview = proxy(request('https://shop.blendpunch.com/mypage', 'sj_preview=1'));
    assert.equal(preview.headers.get('x-middleware-request-x-site'), 'sanjipick');
    const prefixed = proxy(request('https://shop.blendpunch.com/sanji/mypage'));
    assert.equal(prefixed.headers.get('x-middleware-request-x-site'), 'sanjipick');
    assert.match(prefixed.headers.get('set-cookie'), /sj_preview=1/);
  });
  for (const site of ['blendpick', 'sanjipick']) {
    const siteMock = { currentSite: async () => sites.SITES[site] };
    await test(`${site} order list includes user and site constraints`, async () => {
      const { getOrders } = load('lib/customer-orders.ts', {
        '@/lib/db-shop': { query: async (sql, params) => {
          assert.match(sql, /WHERE o\.user_id = \$1 AND o\.site = \$2 AND o\.order_type <> 'hotel'/);
          assert.deepEqual(params, ['user-1', site]);
          return { rows: [{ id: `${site}-order` }] };
        } },
      });
      assert.deepEqual(await getOrders('user-1', site), [{ id: `${site}-order` }]);
    });
    for (const kind of ['cancel', 'return']) {
      await test(`${site} ${kind} rejects an order from the other site before mutation`, async () => {
        let reads = 0;
        const { POST } = load(`app/api/orders/[id]/${kind}/route.ts`, {
          ...baseMocks, '@/lib/site-server': siteMock,
          '@/lib/order-cancel': { cancelShopOrder: () => { throw Error('Unexpected refund'); } },
          '@/lib/db-shop': { query: async (sql, params) => {
            reads++;
            assert.match(sql, /WHERE (?:o\.)?id = \$1 AND (?:o\.)?site = \$2/);
            assert.deepEqual(params, ['other-site-order', site]);
            return { rows: [] };
          } },
        });
        const body = { kind: 'return', reason: '기타', detail: '상품 확인 요청', fee_agreed: true };
        const res = await POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'other-site-order' }) });
        assert.equal(res.status, 404);
        assert.equal(reads, 1);
      });
    }
    await test(`${site} guest lookup scopes verified phone and site`, async () => {
      const { POST } = load('app/api/orders/lookup/route.ts', {
        ...baseMocks, '@/lib/site-server': siteMock,
        '@/lib/db-shop': { query: async (sql, params) => {
          assert.match(sql, /o\.site = \$2/);
          assert.match(sql, /\$2 = 'blendpick' AND o\.order_type = 'hotel'/);
          assert.deepEqual(params, ['01012345678', site]);
          return { rows: [] };
        } },
      });
      assert.equal((await POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ phone: '010-1234-5678' }) }))).status, 200);
    });
    await test(`${site} review eligibility cannot use the other site's purchase`, async () => {
      const { POST } = load('app/api/reviews/route.ts', {
        ...baseMocks, '@/lib/site-server': siteMock,
        '@/lib/db-shop': { query: async (sql, params) => {
          assert.match(sql, /o\.site = \$2/);
          assert.match(sql, /o\.user_id = \$3/);
          assert.deepEqual(params, ['product-1', site, 'user-1']);
          return { rows: [] };
        } },
      });
      const res = await POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ product_id: 'product-1', rating: 5, content: '맛있는 과일이에요' }) }));
      assert.equal(res.status, 403);
    });
  }
  const fixture = { id: 'order-1', order_number: 'SJ-001', total_amount: '29000', status: 'delivered', paid_at: '2026-09-07T00:00:00Z', items: [{ product_id: 'peach-1', product_name: '대향금 복숭아', unit_price: '29000', quantity: 1, reviewed: false }] };
  for (const base of ['', '/sanji']) {
    await test(`sanji account renders own links and no shop sections (base=${base || '/'})`, async () => {
      const { default: Page } = load('components/sanji/SanjiMyPage.tsx', {
        ...baseMocks,
        '@/lib/sanji-link': { sanjiLinkBase: async () => base },
        '@/lib/db': { query: async () => ({ rows: [{ nickname: '테스트 고객', role: 'influencer' }] }) },
        '@/lib/customer-orders': { getOrders: async (user, site) => { assert.equal(site, 'sanjipick'); return [fixture]; } },
      });
      const html = renderToStaticMarkup(await Page());
      assert.match(html, /산지픽 마이페이지/);
      assert.doesNotMatch(html, /호텔|OS 구독|\/influencer/);
      assert.ok(html.includes(`href="${base}/p/peach-1"`));
      assert.ok(html.includes(`href="${base}/mypage/returns/new?order=order-1"`));
      assert.ok(html.includes(`href="${base}/mypage/reviews/new?product=peach-1"`));
      assert.match(html, /29,000/);
    });
  }
  await test('shop account preserves hotel and subscription sections', async () => {
    const { default: Page } = load('app/mypage/page.tsx', {
      ...baseMocks,
      '@/lib/site-server': { currentSite: async () => sites.SITES.blendpick },
      '@/components/sanji/SanjiMyPage': () => { throw Error('Wrong account screen'); },
      '@/lib/db': { query: async () => ({ rows: [{ name: '고객', role: 'customer' }] }) },
      '@/lib/db-shop': { query: async sql => { assert.match(sql, /o.site = 'blendpick'/); return { rows: [] }; } },
      '@/lib/customer-orders': { getOrders: async (user, site) => { assert.equal(site, 'blendpick'); return []; } },
    });
    const html = renderToStaticMarkup(await Page());
    assert.match(html, /호텔 예약 내역/);
    assert.match(html, /OS 구독/);
    assert.doesNotMatch(html, /산지픽 마이페이지/);
  });
  await test('same-site paid order still reaches cancellation service', async () => {
    let refunds = 0;
    const { POST } = load('app/api/orders/[id]/cancel/route.ts', {
      ...baseMocks,
      '@/lib/site-server': { currentSite: async () => sites.SITES.sanjipick },
      '@/lib/db-shop': { query: async () => ({ rows: [{ id: 'own-order', user_id: 'user-1', status: 'paid' }] }) },
      '@/lib/order-cancel': { cancelShopOrder: async id => { assert.equal(id, 'own-order'); refunds++; return { ok: true, refunded: true }; } },
    });
    const res = await POST(new Request('https://example.test/api', { method: 'POST' }), { params: Promise.resolve({ id: 'own-order' }) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'cancelled');
    assert.equal(refunds, 1);
  });
  await test('empty order list and load failure have different messages', () => {
    const { default: Orders } = load('components/CustomerOrders.tsx', baseMocks);
    const empty = renderToStaticMarkup(React.createElement(Orders, { orders: [], sanjiBase: '' }));
    const failed = renderToStaticMarkup(React.createElement(Orders, { orders: null, sanjiBase: '' }));
    assert.match(empty, /아직 산지픽 주문 내역이 없습니다/);
    assert.match(failed, /불러오지 못했습니다/);
    assert.doesNotMatch(failed, /내역이 없습니다/);
  });
  await test('unauthenticated sanji account preserves the login destination', async () => {
    const { default: Page } = load('components/sanji/SanjiMyPage.tsx', {
      ...baseMocks, 'next/headers': { cookies: async () => ({ get: () => undefined }) },
      '@/lib/sanji-link': { sanjiLinkBase: async () => '/sanji' },
      '@/lib/db': {}, '@/lib/customer-orders': {},
    });
    await assert.rejects(Page, /REDIRECT:\/login\?redirect=%2Fsanji%2Fmypage/);
  });
  await test('logout returns to the configured sanji host and clears its cookie', async () => {
    const { GET } = load('app/api/auth/logout/route.ts', { '@/lib/site-server': { currentSite: async () => sites.SITES.sanjipick } });
    const res = await GET(request('https://sanjipick.blendpunch.com/api/auth/logout'));
    assert.equal(res.headers.get('location'), 'https://sanjipick.blendpunch.com/');
    assert.match(res.headers.get('set-cookie'), /shop_token=;.*Max-Age=0/);
  });
  console.log(`${count} checks passed. No production build, database writes, refunds, or deployment.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
