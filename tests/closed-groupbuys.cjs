const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./support/load.cjs');

// Exercise the actual page queries against an isolated PostgreSQL database.
// No production database, HTTP request, or checkout mutation is available here.
const db = new PGlite();
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
const liveIds = Array.from({ length: 16 }, (_, i) => `live-${i + 1}`);
const archivedIds = ['expired', 'ended', 'ended-future'];
const soldOutIds = ['soldout', 'zero-stock'];
const excludedIds = ['hidden', 'draft', 'inactive', 'sanji', 'sanji-farm', 'sanji-seafood', 'future'];

before(async () => {
  await db.exec(`CREATE TABLE products_shop (
    id text PRIMARY KEY, name text, brand text DEFAULT '검증 브랜드',
    category text DEFAULT '생활용품', price integer DEFAULT 10000,
    original_price integer DEFAULT 20000, stock integer DEFAULT 3,
    status text DEFAULT 'active', main_image text DEFAULT '/uploads/test.jpg',
    shipping_type text DEFAULT 'free', shipping_cost integer DEFAULT 0,
    is_visible boolean DEFAULT true, sale_start_at timestamptz,
    sale_end_at timestamptz, created_at timestamptz DEFAULT NOW()
  )`);
  await db.exec(`INSERT INTO products_shop (id, name, created_at)
    SELECT 'live-' || n, '진행상품-' || n, NOW() - interval '30 days' + n * interval '1 hour'
    FROM generate_series(1, 16) n`);
  await db.exec(`INSERT INTO products_shop (id, name, category, status, stock, is_visible, sale_start_at, sale_end_at) VALUES
    ('expired', '기간종료상품', '교육', 'active', 3, true, NOW() - interval '3 days', NOW() - interval '1 day'),
    ('ended', '수동마감상품', '교육', 'ended', 3, true, NULL, NULL),
    ('ended-future', '예약중수동마감상품', '교육', 'ended', 3, true, NOW() + interval '3 days', NOW() + interval '4 days'),
    ('soldout', '품절상태상품', '뷰티', 'soldout', 3, true, NULL, NULL),
    ('zero-stock', '재고품절상품', '뷰티', 'active', 0, true, NULL, NULL),
    ('future', '오픈예정상품', '예정전용분류', 'active', 3, true, NOW() + interval '3 days', NOW() + interval '4 days'),
    ('hidden', '비전시마감상품', '숨김분류', 'ended', 3, false, NULL, NULL),
    ('draft', '초안마감날짜상품', '숨김분류', 'draft', 3, true, NULL, NOW() - interval '1 day'),
    ('inactive', '비활성마감날짜상품', '숨김분류', 'inactive', 3, true, NULL, NOW() - interval '1 day'),
    ('sanji', '산지픽마감상품', '산지픽', 'ended', 3, true, NULL, NULL),
    ('sanji-farm', '산지농산물마감상품', '산지픽 농산물', 'ended', 3, true, NULL, NULL),
    ('sanji-seafood', '산지수산물마감상품', '산지픽 해산물', 'active', 3, true, NULL, NOW() - interval '1 day')`);
});
after(async () => { await db.close(); });

function mocks(extra = {}) {
  return {
    '@/lib/db-shop': { query: (sql, params) => db.query(sql, params) },
    '@/lib/ci-db-free-build': { deferDbFreeBuild: async () => {} },
    '@/lib/best-sellers': { getTopSellerIds: async () => ['expired', 'ended', 'soldout', 'live-1'] },
    '@/components/Header': () => null,
    'next/link': ({ children, href, prefetch, ...props }) => React.createElement('a', { ...props, href }, children),
    '@/components/FallbackImg': ({ src, alt, ...props }) => React.createElement('img', { ...props, src, alt }),
    './BlendHome.module.css': css,
    './catalog.module.css': css,
    ...extra,
  };
}

async function homeProps() {
  const HomeView = () => null;
  const home = load('app/page.tsx', mocks({ '@/components/blend/BlendHome': HomeView })).default;
  const tree = await home();
  return React.Children.toArray(tree.props.children).find(child => child.type === HomeView).props;
}

function assertSaleOrder(products) {
  const livePositions = liveIds.map(id => products.findIndex(p => p.id === id));
  const closedPositions = [...archivedIds, ...soldOutIds].map(id => products.findIndex(p => p.id === id));
  assert.ok(Math.max(...livePositions) < Math.min(...closedPositions), 'purchasable products stay ahead of closed and sold-out products');
  assert.ok(Math.max(...soldOutIds.map(id => products.findIndex(p => p.id === id))) < Math.min(...archivedIds.map(id => products.findIndex(p => p.id === id))), 'sold-out products stay ahead of ended group buys');
}

test('homepage lists all public current and closed group buys beyond twelve without exposing other tenant or private products', async () => {
  const props = await homeProps();
  assert.equal(props.catalogUnavailable, false);
  assert.equal(props.products.length, liveIds.length + archivedIds.length + soldOutIds.length);
  assert.deepEqual(new Set(props.products.map(p => p.id)), new Set([...liveIds, ...archivedIds, ...soldOutIds]));
  for (const id of archivedIds) assert.equal(props.products.find(p => p.id === id).sale_closed, true, id);
  for (const id of liveIds) assert.equal(props.products.find(p => p.id === id).sale_closed, false, id);
  for (const id of excludedIds) assert.ok(!props.products.some(p => p.id === id), id);
  assertSaleOrder(props.products);
  assert.deepEqual(new Set(props.categories), new Set(['생활용품', '교육', '뷰티']));
  assert.deepEqual(props.upcoming.map(p => p.id), ['future']);
});

async function catalog(category) {
  let carouselProducts = [];
  const queries = [];
  const page = load('app/products/page.tsx', mocks({
    '@/lib/db-shop': { query: async (sql, params) => {
      const result = await db.query(sql, params);
      queries.push({ sql, params, rows: result.rows });
      return result;
    } },
    '@/components/ProductCarousel': ({ products }) => { carouselProducts = products; return null; },
  })).default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve(category ? { category } : {}) }));
  const products = queries.find(q => q.sql.includes('original_price') && q.sql.includes('FROM products_shop')).rows;
  return { html, products, carouselProducts };
}

test('product catalog preserves closed products in category results and keeps future opening separate', async () => {
  const all = await catalog();
  assert.deepEqual(new Set(all.products.map(p => p.id)), new Set([...liveIds, ...archivedIds, ...soldOutIds]));
  assertSaleOrder(all.products);
  assert.ok(all.carouselProducts.every(p => liveIds.includes(p.id)), 'the selling carousel must not advertise closed or sold-out products');
  const education = await catalog('교육');
  assert.deepEqual(new Set(education.products.map(p => p.id)), new Set(archivedIds));
  assert.ok(education.products.every(p => p.sale_closed));
  assert.match(education.html, /기간종료상품/);
  assert.match(education.html, /수동마감상품/);
  assert.doesNotMatch(education.html, /진행상품-/);
  assert.equal(education.carouselProducts.length, 0);
});

function linkMarkup(html, href, attribute) {
  const matches = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || [];
  const found = matches.find(markup => markup.includes(`href="${href}"`) && (!attribute || markup.includes(attribute)));
  assert.ok(found, `expected link ${href}${attribute ? ` with ${attribute}` : ''}`);
  return found;
}

test('homepage distinguishes ended cards from available cards and never promotes an ended product in the hero', async () => {
  const props = await homeProps();
  const Home = load('components/blend/BlendHome.tsx', mocks()).default;
  const html = renderToStaticMarkup(React.createElement(Home, props));
  for (const id of archivedIds) {
    const card = linkMarkup(html, `/products/${id}`, 'data-sale-state="ended"');
    assert.match(card, /공구 마감/);
    assert.match(card, /판매 종료 · 구매 불가/);
    assert.doesNotMatch(card, /BEST|50%|<del>|무료배송|구매하기/);
  }
  for (const id of soldOutIds) assert.match(linkMarkup(html, `/products/${id}`, 'data-sale-state="soldout"'), /품절/);
  const available = linkMarkup(html, '/products/live-1', 'data-sale-state="open"');
  assert.match(available, /BEST/);
  assert.match(available, /50%/);
  assert.match(available, /무료배송/);
  const archivedOnly = renderToStaticMarkup(React.createElement(Home, { ...props, products: props.products.filter(p => p.sale_closed) }));
  const hero = linkMarkup(archivedOnly, '/products', 'class="shoppingPostcard"');
  assert.match(hero, /갖고 싶던 일상/);
  assert.doesNotMatch(hero, /기간종료상품|수동마감상품/);
});

test('catalog ended cards keep information links without purchase promotions while active cards keep purchase actions', async () => {
  const { html } = await catalog();
  for (const id of archivedIds) {
    const card = linkMarkup(html, `/products/${id}`);
    assert.match(card, /class="[^"]*closedProduct/);
    assert.match(card, /공구 마감 · 구매 불가/);
    assert.doesNotMatch(card, /BEST|50%|무료배송|구매하기/);
  }
  const available = linkMarkup(html, '/products/live-1');
  assert.match(available, /BEST/);
  assert.match(available, /50%/);
  assert.match(available, /구매하기/);
});
