const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./support/load.cjs');

const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const queries = [];
const { getBlendHelpCatalog } = load('lib/blend-ai-catalog.ts', {
  'server-only': {},
  '@/lib/db-shop': { query: async config => {
    queries.push(config);
    return db.query(config.text, config.values);
  } },
});

before(async () => {
  await db.exec(`CREATE TABLE products_shop (
    id uuid PRIMARY KEY, name text, category text DEFAULT '생활용품', brand text DEFAULT '블랜드',
    price integer DEFAULT 20000, status text DEFAULT 'active', stock integer DEFAULT -1,
    is_visible boolean DEFAULT true, created_at timestamptz DEFAULT NOW(),
    sale_start_at timestamptz, sale_end_at timestamptz,
    description text DEFAULT '<p>공개된 상품 설명입니다.</p>',
    shipping_type text DEFAULT 'paid', shipping_cost integer DEFAULT 3000,
    free_shipping_threshold integer, per_unit_shipping_cost integer DEFAULT 0,
    island_shipping_cost integer DEFAULT 0, installation_cost integer DEFAULT 0,
    expected_ship_date date,
    supply_price integer DEFAULT 1987,
    supplier_name text DEFAULT 'PRIVATE_SUPPLIER',
    link_code text DEFAULT 'PRIVATE_SECRET_CODE'
  )`);
  const fixtures = [
    [1, '무제한 텀블러', '생활용품', 'active', -1, true, null, null],
    [2, '예정 상품', '생활용품', 'active', 3, true, '2099-10-06T03:00:00Z', '2099-10-10T03:00:00Z'],
    [3, '품절 상품', '뷰티', 'soldout', 3, true, null, null],
    [4, '수동마감 상품', '교육', 'ended', 3, true, '2099-01-01T00:00:00Z', null],
    [5, '기간마감 상품', '교육', 'active', 3, true, null, '2020-10-06T03:00:00Z'],
    [6, '재고0 상품', '뷰티', 'active', 0, true, null, null],
    [7, '초안 비공개', '생활용품', 'draft', 3, true, null, null],
    [8, '비활성 비공개', '생활용품', 'inactive', 3, true, null, null],
    [9, '숨김 비밀상품', '생활용품', 'active', 3, false, null, null],
    [10, '산지 비공개', '산지픽', 'active', 3, true, null, null],
    [11, '농산물 비공개', '산지픽 농산물', 'active', 3, true, null, null],
    [12, '수산물 비공개', '산지픽 해산물', 'active', 3, true, null, null],
  ];
  for (const [number, name, category, status, stock, visible, start, end] of fixtures) {
    await db.query(`INSERT INTO products_shop (id, name, category, status, stock, is_visible, sale_start_at, sale_end_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id(number), name, category, status, stock, visible, start, end]);
  }
});
after(async () => { await db.close(); });

test('actual catalog SQL includes only publicly listed Blendpick products and preserves sale states', async () => {
  queries.length = 0;
  const result = await getBlendHelpCatalog('/', '');
  const data = JSON.parse(result.context);
  assert.equal(data.조회상태, '성공');
  assert.equal(data.시간대, 'Asia/Seoul');
  assert.match(data.조회시각KST, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const states = new Map(data.상품목록.map(row => [row[0], row[3]]));
  assert.deepEqual(new Set(states.keys()), new Set(['무제한 텀블러', '예정 상품', '품절 상품', '수동마감 상품', '기간마감 상품', '재고0 상품']));
  assert.equal(states.get('무제한 텀블러'), '진행 중');
  assert.equal(states.get('예정 상품'), '오픈 예정');
  assert.equal(states.get('품절 상품'), '품절');
  assert.equal(states.get('재고0 상품'), '품절');
  assert.equal(states.get('수동마감 상품'), '공구 마감');
  assert.equal(states.get('기간마감 상품'), '공구 마감');
  assert.doesNotMatch(result.context, /비공개|비밀상품|PRIVATE_|1987/);
  assert.deepEqual(result.links, []);
  assert.equal(queries.length, 1);
});

test('public product detail uses exact current path, public shipping and real KST sale dates', async () => {
  const current = await getBlendHelpCatalog(`/products/${id(5)}`, '');
  const data = JSON.parse(current.context);
  assert.equal(data.관련상품.length, 1);
  assert.equal(data.관련상품[0].상품명, '기간마감 상품');
  assert.equal(data.관련상품[0].공구종료KST, '2020-10-06 12:00');
  assert.equal(data.관련상품[0].판매상태, '공구 마감');
  assert.equal(data.관련상품[0].배송안내, '배송비 3,000원');
  assert.equal(data.관련상품[0].출고안내, '출고 일정 확인 중');
  assert.deepEqual(current.links, [{ label: '기간마감 상품', href: `/products/${id(5)}` }]);
  assert.match(data.확인범위, /호텔 실시간 객실 재고는 조회하지 않았습니다/);
  assert.match(data.환불적용범위, /숙박·예약에는 적용하지 않/);
});

test('private, inactive and other-site current paths cannot bypass the public detail predicate', async () => {
  for (const number of [7, 8, 9, 10, 11, 12]) {
    const result = await getBlendHelpCatalog(`/products/${id(number)}`, '');
    assert.deepEqual(result.links, []);
    assert.deepEqual(JSON.parse(result.context).관련상품, []);
    assert.doesNotMatch(result.context, /비공개|비밀상품|PRIVATE_/);
  }
});

test('client paths and question text are never interpolated into SQL or returned as links', async () => {
  for (const current of [`/products/${id(1)}?k=SECRET`, `https://evil.invalid/products/${id(1)}`, `/products/${id(1)}/extra`, '/products/not-a-uuid', '/products/../../admin', '//evil.invalid/']) {
    queries.length = 0;
    const result = await getBlendHelpCatalog(current, "'; UPDATE products_shop SET status = 'ended'; --");
    assert.deepEqual(result.links, []);
    assert.equal(queries.length, 1);
    assert.ok(!queries[0].text.includes('evil.invalid'));
    assert.ok(!queries[0].text.includes('UPDATE'));
  }
});

test('matching product or category words selects public details and builds only canonical product links', async () => {
  const product = await getBlendHelpCatalog('/', '무제한 텀블러의 배송비 알려줘');
  assert.deepEqual(product.links, [{ label: '무제한 텀블러', href: `/products/${id(1)}` }]);
  const particle = await getBlendHelpCatalog('/', '텀블러는 언제 마감돼요?');
  assert.deepEqual(particle.links, [{ label: '무제한 텀블러', href: `/products/${id(1)}` }]);
  const category = await getBlendHelpCatalog('/', '교육 공구는 어떤 것이 있어요?');
  assert.deepEqual(new Set(category.links.map(link => link.href)), new Set([`/products/${id(4)}`, `/products/${id(5)}`]));
  for (const config of queries) {
    assert.match(config.text.trim(), /^SELECT\s/i);
    assert.doesNotMatch(config.text, /SELECT\s+\*|\b(?:orders|order_items|supply_price|supplier_name|buyer_phone|link_code|main_image|reviews)\b/i);
    assert.match(config.text, /is_visible = true/);
    assert.match(config.text, /category <> ALL\(\$1::text\[\]\)/);
    assert.equal(config.query_timeout, 5000);
  }
});

test('context and detailed descriptions stay bounded and source markup, contacts and stored URLs do not escape', async () => {
  const rows = Array.from({ length: 80 }, (_, n) => ({
    id: id(n + 100), name: `긴이름 ${n} ${'상품'.repeat(300)}`, category: '긴분류'.repeat(30), brand: '긴브랜드'.repeat(30),
    price: 99000, sale_state: 'open', snapshot_kst: '2026-10-06 14:00:00', sale_start_kst: null, sale_end_kst: null,
    description: '<script>PRIVATE_SCRIPT</script><img src="https://evil.invalid/x">https://evil.invalid/path supplier@example.invalid 010-1234-5678 ' + '설명'.repeat(2000),
    shipping_type: 'paid', shipping_cost: 3000, expected_ship_date: null,
  }));
  const configs = [];
  const engine = load('lib/blend-ai-catalog.ts', {
    'server-only': {},
    '@/lib/db-shop': { query: async config => {
      configs.push(config);
      return { rows: config.values[1] ? rows.filter(row => config.values[1].includes(row.id)) : rows };
    } },
  });
  const result = await engine.getBlendHelpCatalog('/', '긴이름');
  const data = JSON.parse(result.context);
  assert.ok(result.context.length <= 10000, result.context.length);
  assert.equal(data.관련상품.length, 4);
  assert.equal(result.links.length, 4);
  assert.ok(data.상품목록.length <= 80);
  assert.equal(data.목록일부생략, true);
  assert.match(data.목록범위, /전체가 아닐 수/);
  assert.doesNotMatch(result.context, /PRIVATE_SCRIPT|<script|<img|https:\/\/evil|supplier@|010-1234-5678/);
  for (const detail of data.관련상품) assert.ok(detail.공개설명.length <= 700);
  for (const link of result.links) assert.match(link.href, /^\/products\/[0-9a-f-]{36}$/);
  assert.match(configs[0].text, /LIMIT 80/);
  assert.match(configs[1].text, /LIMIT 4/);
});

test('catalog failure and timeout stop the caller without revealing database diagnostics', async () => {
  const engine = load('lib/blend-ai-catalog.ts', {
    'server-only': {},
    '@/lib/db-shop': { query: async () => { throw new Error('PRIVATE_CONNECTION timeout'); } },
  });
  await assert.rejects(engine.getBlendHelpCatalog('/', '공구'), error => error.message === 'PUBLIC_CATALOG_UNAVAILABLE');
});
