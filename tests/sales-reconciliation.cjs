// Real SQL and route handlers against synthetic PostgreSQL data only.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { load } = require('./support/load.cjs');
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const query = async (sql, args = []) => {
  const r = await db.query(sql, args);
  return { ...r, rowCount: r.affectedRows ?? r.rows.length };
};
const mocks = {
  '@/lib/db-shop': { query }, '@/lib/db': { query },
  'next/headers': {
    cookies: async () => ({ get: () => ({ value: 'isolated' }) }),
    headers: async () => new Headers({ host: 'shop.blendpunch.com' }),
  },
  '@/lib/auth': { verifyAdminToken: async () => ({}) },
};
const finance = load('lib/order-finance.ts', mocks);
const links = () => load('lib/link-sales.ts', mocks).getLinkSales('blendpick', '2026-09-27T15:00:00Z', '2026-09-28T15:00:00Z');
const profit = async () => {
  const response = await load('app/api/admin/profit/route.ts', mocks).GET(new Request('https://shop.blendpunch.com/api/admin/profit'));
  assert.equal(response.status, 200);
  return response.json();
};
async function order(n = 10, { site = 'blendpick', type = 'shop', status = 'paid', key = 'isolated-payment', inf = 999, amount = 100000, paid = '2026-09-28T02:00:00Z', campaign = null } = {}) {
  await query(`INSERT INTO orders(id,site,order_type,order_number,paid_at,status,total_amount,shipping_fee,payment_key,payment_method,influencer_id,influencer_name,commission_rate,campaign_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,'transfer',$9,$10,10,$11)`,
  [id(n), site, type, 'TEST-' + n, paid, status, amount, key, inf ? id(inf) : null, inf ? '주문 당시 파트너 ' + inf : null, campaign ? id(campaign) : null]);
  await query(`INSERT INTO order_items(id,order_id,product_id,product_ref,product_name,quantity,unit_price,supply_price,tax_type)
    VALUES($1,$2,$3,$3,'격리 상품',1,$4,20000,'taxable')`, [id(n + 1000), id(n), id(1), amount]);
}
async function record(n = 10, minutes = 30) {
  await query(`INSERT INTO settlements(order_id,gross_amount,fee,net_amount,settled_at,created_at,fee_estimated)
    VALUES($1,100000,1650,98350,((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date::timestamp AT TIME ZONE 'Asia/Seoul') + $2 * INTERVAL '1 minute',NOW(),true)`, [id(n), minutes]);
}
const detail = () => load('lib/settlement-view.ts', mocks).settlementView('blendpick');
async function dashboard(extraMocks = {}) {
  return (await load('app/admin/(protected)/page.tsx', { ...mocks, '@/components/admin/AdminDashboardView': () => null, ...extraMocks }).default({ searchParams: Promise.resolve({}) })).props;
}
before(async () => {
  await require('./support/integrity-schema.cjs')(db, id);
  await db.exec("SET TIME ZONE 'UTC'; CREATE TABLE reviews(id uuid,order_id uuid,created_at timestamptz); ALTER TABLE order_returns ADD COLUMN items jsonb;");
  // Catalog IDs may be text even though order/payout references use UUIDs.
  await db.exec('ALTER TABLE influencers ALTER COLUMN id TYPE text; ALTER TABLE campaigns ALTER COLUMN id TYPE text;');
  await query("INSERT INTO influencers(id,name,business_type) VALUES($1,'다른 파트너','freelancer')", [id(998)]);
});
beforeEach(async () => db.exec('TRUNCATE orders,order_items,settlements,campaign_costs,order_refund_amounts,refund_operations,influencer_payouts,campaigns CASCADE'));
after(async () => db.close());

test('influencer settlements accept text catalog IDs without hiding catalog errors', async () => {
  await order();
  const response = await load('app/api/admin/influencer-settlements/route.ts', mocks).GET();
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows[0].influencer_id, id(999));
  assert.equal(rows[0].business_type, 'general');
  assert.equal(rows[0].commission, 10000);
  await assert.rejects(load('lib/influencer-finance.ts', { ...mocks, '@/lib/db': { query: async () => { throw Error('catalog offline'); } } }).influencerFinance('blendpick'), /catalog offline/);
});

test('shop and hotel profit retain order attribution and business filters; direct sales stay separate', async () => {
  await order(10); await order(11, { inf: 998, amount: 70000 }); await order(12, { inf: null, amount: 30000 });
  await order(13, { type: 'hotel', inf: 999, amount: 200000 });
  const rows = await profit();
  assert.equal(rows.length, 4);
  assert.equal(rows.filter(r => r.influencer_id === id(999)).reduce((n, r) => n + r.gross, 0), 300000);
  assert.equal(rows.filter(r => r.business_type === 'freelancer').reduce((n, r) => n + r.gross, 0), 70000);
  assert.equal(rows.find(r => !r.influencer_id).gross, 30000);
  assert.equal(new Set(rows.map(r => r.group_key)).size, rows.length);
});

test('current campaign owner cannot rewrite historical attribution; shared costs are counted once', async () => {
  await query('INSERT INTO campaigns(id,influencer_id) VALUES($1,$2)', [id(50), id(998)]);
  await order(10, { type: 'campaign', campaign: 50, amount: 100001 });
  await order(11, { type: 'campaign', campaign: 50, inf: 998, amount: 50000 });
  await query("INSERT INTO campaign_costs(campaign_id,site,category,amount) VALUES($1,'blendpick','shipping',1001),($1,'blendpick','ad',503),($1,'sanjipick','ad',99999)", [id(50)]);
  const rows = await profit();
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.influencer_id === id(999)).gross, 100001);
  assert.equal(rows.reduce((n, r) => n + r.shipping_cost, 0), 1001);
  assert.equal(rows.reduce((n, r) => n + r.other_costs, 0), 503);
  for (const r of rows) assert.equal(r.net_profit, r.gross - r.sales_vat - r.supply_cost - r.shipping_cost - r.pg_fee - r.other_costs - r.commission);
});

test('unassigned shop costs are not multiplied across influencers or hotel groups', async () => {
  await order(); await order(11, { inf: 998 }); await order(12, { type: 'hotel' });
  await query("INSERT INTO campaign_costs(site,category,amount) VALUES('blendpick','shipping',1001)");
  assert.equal((await profit()).reduce((n, r) => n + r.shipping_cost, 0), 1001);
});

test('fully refunded owners still share all costs exactly once and keep profit unresolved', async () => {
  await order(); await order(11, { inf: 998 });
  await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('a',$1,100000),('b',$2,100000)", [id(10), id(11)]);
  await query("INSERT INTO campaign_costs(site,category,amount) VALUES('blendpick','shipping',1001)");
  const rows = await profit();
  assert.equal(rows.reduce((n, r) => n + r.shipping_cost, 0), 1001);
  assert.ok(rows.every(r => r.net_profit === null && r.review_reasons.includes('환불 후 회수 원가 확인 필요')));
});

test('dashboard and detail agree on refund-adjusted amounts, duplicate records and 00:30 KST', async () => {
  await order(); await record(); await record();
  await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('partial',$1,20000)", [id(10)]);
  const rows = await detail();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].net_amount, 78680);
  assert.equal((await dashboard()).stats.todaySettlement, rows[0].net_amount);
});

test('unresolved settlements remain unknown, not zero, and period boundaries use KST', async () => {
  await order(); await record();
  await query('UPDATE orders SET refund_amount_unresolved=true');
  assert.equal((await dashboard()).stats.todaySettlement, null);
  const { settlementTotal, settlementInPeriod } = load('lib/settlement-view.ts', mocks);
  assert.equal(settlementTotal(await detail(), 'today'), null);
  assert.equal(settlementTotal([], 'today'), 0);
  const now = new Date('2026-09-30T15:30:00Z');
  assert.equal(settlementInPeriod('2026-09-30T15:00:00Z', 'today', now), true);
  assert.equal(settlementInPeriod('2026-09-30T14:59:59Z', 'today', now), false);
  assert.equal(settlementInPeriod('2026-09-30T14:59:59Z', 'month', now), false);
  assert.equal(settlementInPeriod('2026-09-27T15:00:00Z', 'week', now), true);
  assert.equal(settlementInPeriod('2026-09-27T14:59:59Z', 'week', now), false);
});

test('dashboard reports read failures and keeps unavailable settlement amounts unknown', async () => {
  const errors = [];
  const result = await dashboard({ '@/lib/settlement-view': { settlementView: async () => { throw Error('unavailable'); } }, '@/lib/api-errors': { reportApiError: (e, op) => errors.push(op) } });
  assert.equal(result.stats.todaySettlement, null);
  assert.deepEqual(errors, ['admin.dashboard.settlements']);
});

test('link sales include campaign orders and pending refunds without multiplying lines or refunds', async () => {
  await order(10, { type: 'campaign' });
  await query('UPDATE order_items SET quantity=2,unit_price=40000');
  await query("INSERT INTO order_items(order_id,product_ref,quantity,unit_price) VALUES($1,$2,1,20000)", [id(10), id(1)]);
  await query("INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES('a',$1,10000),('b',$1,5000)", [id(10)]);
  await query("INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,total,idempotency_key,status) VALUES('pending',$1,20000,15000,'test',100000,'pending','needs_review')", [id(10)]);
  const [row] = await links();
  assert.equal(row.orders, 1); assert.equal(Number(row.units), 3);
  assert.equal(Number(row.gross), 100000); assert.equal(Number(row.refunds), 15000);
  assert.equal(row.unresolved, 1);
  await query("UPDATE refund_operations SET status='rejected'");
  assert.equal((await links())[0].unresolved, 0);
});

test('paid eligibility, host and date boundaries agree across financial and product/link sales', async () => {
  await order(10, { key: '' }); await order(11, { status: 'pending' }); await order(12, { key: 'SIM_test' });
  await order(13, { site: 'sanjipick' }); await order(14, { paid: '2026-09-28T15:00:00Z' });
  await order(15, { paid: '2026-09-27T15:00:00Z' });
  const rows = await finance.financialOrders('blendpick', '2026-09-28', '2026-09-28');
  assert.deepEqual(rows.map(r => r.id), [id(15)]);
  assert.equal((await links())[0].orders, 1);
  const products = await load('lib/product-sales.ts', mocks).getProductSales('blendpick', '2026-09-28', '2026-09-28');
  assert.equal(products.get(id(1)).paid, 1);
});

test('legacy missing costs and refunded costs stay unknown without removing their sales', async () => {
  await order(); await query('UPDATE order_items SET tax_type=NULL,supply_price=NULL');
  const [row] = await profit();
  assert.equal(row.gross, 100000); assert.equal(row.net_profit, null);
  assert.ok(row.review_reasons.includes('공급가 미입력'));
  assert.ok(row.review_reasons.includes('주문 당시 과세 구분 미확인'));
});
