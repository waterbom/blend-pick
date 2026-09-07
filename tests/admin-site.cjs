// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite node tests/admin-site.cjs
// Uses an isolated PostgreSQL WASM database; all auth, payment, SMS and tracking calls are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, cache = new Map()) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const mod = { exports: {} }; cache.set(full, mod);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: full,
  }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === '@/lib/db' || name === '@/lib/db-shop') throw Error('Unmocked production database');
    if (name.startsWith('@/')) return load(['.ts', '.tsx'].map(ext => name.slice(2) + ext).find(f => fs.existsSync(path.join(root, f))), mocks, cache);
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(localRequire, mod, mod.exports);
  return mod.exports;
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const product = id(90), campaign = id(91), influencer = id(92), user = id(93);
const db = new PGlite();
const pool = {
  query: async (sql, params) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
  connect: async () => ({ query: pool.query, release() {} }),
};
let site = 'sanjipick', httpCalls = 0;
const http = global.fetch;
global.fetch = async () => { httpCalls++; throw Error('Unexpected external request'); };
const sites = load('lib/sites.ts').SITES;
const mocks = {
  'next/headers': { headers: async () => new Headers({ host: sites[site].host, 'x-site': site === 'sanjipick' ? 'blendpick' : 'sanjipick' }), cookies: async () => ({ get: () => ({ value: 'test-token' }) }) },
  'next/navigation': { redirect: url => { throw Error(`REDIRECT:${url}`); }, notFound: () => { throw Error('NOT_FOUND'); }, usePathname: () => '/admin' },
  'next/link': ({ children, ...props }) => React.createElement('a', props, children),
  '@/lib/db-shop': pool,
  '@/lib/db': { query: async sql => {
    if (sql.includes('FROM campaigns')) return { rows: [{ id: campaign, commission_rate: 5, influencer_id: influencer, influencer_name: 'Partner', product_name: 'Fruit', business_type: 'freelancer', start_date: '2026-01-01', end_date: '2026-12-31' }] };
    if (sql.includes('FROM influencers')) return { rows: [{ id: influencer, name: 'Partner', business_type: 'freelancer' }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 1 }] };
    return { rows: [{ id: user, name: 'Customer', role: 'customer' }] };
  } },
  '@/lib/auth': { verifyAdminToken: async () => ({ id: id(99), name: 'Admin' }), verifyToken: async () => ({ id: user }) },
  '@/lib/sms': { smsConfigured: () => false, phoneVerifyOn: () => false },
  '@/lib/ship-notify': { sendShipmentSMS: () => { throw Error('Unexpected SMS'); } },
  '@/lib/return-notify': { sendReturnRefundSMS: () => { throw Error('Unexpected SMS'); } },
  '@/lib/hotel-notify': { sendReservationSMS: () => { throw Error('Unexpected SMS'); } },
  '@/lib/hotel-cancel': { cancelHotelReservation: () => { throw Error('Unexpected hotel refund'); } },
  '@/lib/order-cancel': { cancelShopOrder: () => { throw Error('Unexpected refund'); } },
  '@/lib/phone-verify': { isPhoneVerified: async () => true },
  '@/lib/sale-window': { findClosedSaleProduct: async () => null },
  '@/lib/inf-ref': { infRefFromCookie: async () => null },
  '@/components/admin/TrackingForm': () => null,
};
const req = (pathname, body, method = 'POST') => new Request(`https://${sites[site].host}${pathname}`, { method: body === undefined ? 'GET' : method, headers: { host: sites[site].host, 'x-site': site }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
let passed = 0;
async function test(label, fn) { await fn(); passed++; console.log(`PASS ${label}`); }
async function orderStatus(n) { return (await db.query('SELECT status FROM orders WHERE id = $1', [id(n)])).rows[0].status; }

(async () => {
  await db.exec(`
    CREATE TABLE orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text UNIQUE, site text NOT NULL DEFAULT 'blendpick',
      user_id text, influencer_id uuid, influencer_name text, campaign_id uuid, commission_rate numeric,
      status text DEFAULT 'paid', order_type text DEFAULT 'shop', total_amount integer, shipping_fee integer DEFAULT 0,
      buyer_name text, buyer_phone text, buyer_email text, recipient_name text, recipient_phone text,
      addr_zipcode text, addr_address text, addr_detail text, addr_memo text, payment_key text, payment_method text,
      tracking_company text, tracking_number text, created_at timestamptz DEFAULT NOW(), paid_at timestamptz DEFAULT NOW(),
      updated_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz,
      stay_check_in date, stay_check_out date
    );
    CREATE TABLE products_shop (id uuid PRIMARY KEY, name text, product_code text, category text, status text, stock integer,
      sale_type text, sale_start_at timestamptz, sale_end_at timestamptz, influencer_rate numeric, supply_price integer,
      return_cost_roundtrip integer);
    CREATE TABLE product_options (id uuid PRIMARY KEY, product_id uuid, value text, stock integer, supply_price integer);
    CREATE TABLE cart (id uuid PRIMARY KEY);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id), product_id uuid,
      product_name text, option_id uuid, option_label text, unit_price integer, quantity integer, supply_price integer);
    CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id), product_id uuid,
      buyer_name text, rating integer, content text, images text[], is_hidden boolean DEFAULT false, created_at timestamptz DEFAULT NOW());
    CREATE TABLE settlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid, payment_key text, gross_amount integer,
      fee integer, net_amount integer, settled_at timestamptz DEFAULT NOW(), created_at timestamptz DEFAULT NOW());
    CREATE TABLE order_returns (id uuid PRIMARY KEY, order_id uuid, kind text, status text, items jsonb, reason text, detail text,
      photos jsonb, pickup_address text, pickup_detail text, fee_agreed boolean, prev_status text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE order_return_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), return_id uuid, status text, note text,
      admin_name text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE campaign_costs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid, category text, amount integer,
      memo text, created_at timestamptz DEFAULT NOW());
    CREATE TABLE influencer_payouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid, influencer_id uuid,
      business_type text, gross_sales bigint, commission_rate numeric, commission bigint, supply_value bigint, vat bigint,
      withholding bigint, payout_amount bigint, status text DEFAULT 'pending', paid_at timestamptz, updated_at timestamptz,
      UNIQUE (campaign_id, influencer_id));
    INSERT INTO products_shop(id,name,product_code,category,status,stock,sale_type,influencer_rate,supply_price)
      VALUES ('${product}','Fruit','TEST-FRUIT','산지픽','active',100,'groupbuy',5,1000);
    INSERT INTO influencer_payouts(id,campaign_id,influencer_id,status,payout_amount)
      VALUES ('${id(80)}','${campaign}','${influencer}','pending',500);
    INSERT INTO campaign_costs(campaign_id,category,amount) VALUES ('${campaign}','shipping',100);
  `);
  await test('migration is idempotent, preserves history and allows separate site snapshots', async () => {
    const sql = fs.readFileSync(path.join(root, 'scripts/admin-site.sql'), 'utf8');
    await db.exec(`BEGIN;${sql}COMMIT;`); await db.exec(`BEGIN;${sql}COMMIT;`);
    const old = (await db.query('SELECT id, site, payout_amount FROM influencer_payouts')).rows[0];
    assert.equal(old.id, id(80)); assert.equal(old.site, 'blendpick'); assert.equal(Number(old.payout_amount), 500);
    await db.query("INSERT INTO influencer_payouts(id,campaign_id,influencer_id,site,status,payout_amount) VALUES ($1,$2,$3,'sanjipick','pending',700)", [id(81), campaign, influencer]);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM influencer_payouts')).rows[0].n, 2);
    await db.query("INSERT INTO campaign_costs(campaign_id,category,amount,site) VALUES ($1,'shipping',200,'sanjipick')", [campaign]);
  });
  for (const [n, brand, amount, status] of [[1,'blendpick',11000,'paid'],[2,'sanjipick',22000,'paid'],[3,'blendpick',33000,'shipped'],[4,'sanjipick',44000,'shipped']]) {
    await db.query(`INSERT INTO orders(id,order_number,site,user_id,influencer_id,campaign_id,commission_rate,total_amount,status,buyer_name,payment_key,payment_method)
      VALUES($1,$2,$3,$4,$5,$6,5,$7,$8,'Customer','SIM_TEST','card')`, [id(n), `TEST-${n}`, brand, user, influencer, campaign, amount, status]);
    await db.query('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,supply_price) VALUES ($1,$2,\'Fruit\',$3,1,1000)', [id(n), product, amount]);
    await db.query('INSERT INTO settlements(order_id,payment_key,gross_amount,fee,net_amount) VALUES ($1,\'SIM_TEST\',$2,100,$2-100)', [id(n),amount]);
  }
  for (const [n, o] of [[31,3],[41,4]]) {
    await db.query("INSERT INTO order_returns(id,order_id,kind,status,reason,prev_status) VALUES($1,$2,'return','requested','기타','shipped')", [id(n),id(o)]);
    await db.query("INSERT INTO reviews(id,order_id,product_id,buyer_name,rating,content) VALUES($1,$2,$3,'Customer',5,'Fruit review')", [id(n+1),id(o),product]);
  }
  const { currentAdminSite } = load('lib/admin-site.ts', mocks);
  const { proxy } = load('proxy.ts');
  for (const brand of ['blendpick', 'sanjipick']) {
    site = brand; const own = site === 'blendpick' ? 1 : 2, other = own === 1 ? 2 : 1;
    await test(`${site}: host overrides spoofed site headers and preview cookie`, async () => {
      assert.equal((await currentAdminSite()).key, site);
      const r = proxy(new NextRequest(`https://${sites[site].host}/api/admin/orders?site=${sites[other === 1 ? 'blendpick':'sanjipick'].key}`, { headers: { host: sites[site].host, cookie: 'sj_preview=1', 'x-site': 'spoof' } }));
      assert.equal(r.headers.get('x-middleware-request-x-site'), site);
    });
    await test(`${site}: orders API ignores cross-site query filter`, async () => {
      const { GET } = load('app/api/admin/orders/route.ts', mocks);
      const result = await (await GET(req('/api/admin/orders?site=all'))).json();
      assert.equal(result.length,2);assert.ok(result.every(o => o.site === site));
    });
    await test(`${site}: mixed batch and foreign cancellation never reach payment service`, async () => {
      const { PATCH } = load('app/api/admin/orders/route.ts', mocks);
      assert.equal((await PATCH(req('/api/admin/orders',{orderIds:[id(own),id(other)],action:'confirm'},'PATCH'))).status,404);
      const single = load('app/api/admin/orders/[id]/route.ts',mocks);
      assert.equal((await single.PATCH(req('/api/admin/orders/x',{status:'cancelled'},'PATCH'),{params:Promise.resolve({id:id(other)})})).status,404);
      assert.equal(await orderStatus(other),'paid'); assert.equal(httpCalls,0);
    });
    await test(`${site}: own-order status transition succeeds`, async () => {
      const { PATCH }=load('app/api/admin/orders/route.ts',mocks);
      const r=await PATCH(req('/api/admin/orders',{orderIds:[id(own)],action:'confirm'},'PATCH'));
      assert.equal(r.status,200); assert.equal(await orderStatus(own),'confirmed');
      await db.query("UPDATE orders SET status='paid' WHERE id=$1",[id(own)]);
    });
    await test(`${site}: foreign order detail is not found`,async()=>{
      const Page=load('app/admin/(protected)/orders/[id]/page.tsx',mocks).default;
      await assert.rejects(()=>Page({params:Promise.resolve({id:id(other)})}),/NOT_FOUND/);
    });
    await test(`${site}: returns list, refund balance and mutation are isolated`,async()=>{
      const returns=load('app/api/admin/returns/route.ts',mocks);
      const list=await(await returns.GET(req('/api/admin/returns?kind=return'))).json();
      assert.equal(list.length,1);assert.equal(list[0].order_id,id(own+2));
      const otherReturn=id(other===1?31:41);
      assert.equal((await returns.PATCH(req('/api/admin/returns',{id:otherReturn,action:'complete',refund_amount:100},'PATCH'))).status,404);
      const balance=load('app/api/admin/returns/balance/route.ts',mocks);
      assert.equal((await balance.GET(req(`/api/admin/returns/balance?id=${otherReturn}`))).status,404);
    });
    await test(`${site}: shipment import cannot change another site's order`,async()=>{
      const {POST}=load('app/api/admin/shipments/import/route.ts',mocks);
      const result=await(await POST(req('/api/admin/shipments/import',{rows:[{order_number:`TEST-${other}`,carrier:'04',tracking_number:'12345678'}]}))).json();
      assert.equal(result.succeeded,0);assert.equal(await orderStatus(other),'paid');
      const deliver=load('app/api/admin/shipments/deliver/route.ts',mocks);
      assert.equal((await deliver.PATCH(req('/api/admin/shipments/deliver',{orderIds:[id(own+2),id(other+2)]},'PATCH'))).status,404);
    });
    await test(`${site}: reviews and member purchase history do not expose other-site purchases`,async()=>{
      const reviews=await(await load('app/api/admin/reviews/route.ts',mocks).GET()).json();assert.equal(reviews.length,1);
      const member=await(await load('app/api/admin/members/[id]/route.ts',mocks).GET(req('/api/admin/members/x'),{params:Promise.resolve({id:user})})).json();
      assert.equal(member.orders.length,2);assert.ok(member.orders.every(o=>[own,own+2].some(n=>o.order_number===`TEST-${n}`)));
    });
    await test(`${site}: dashboard and settlement SQL totals are scoped`,async()=>{
      const dashboard=renderToStaticMarkup(await load('app/admin/(protected)/page.tsx',mocks).default());
      assert.ok(dashboard.includes(sites[site].name+' 대시보드'));
      assert.ok(dashboard.includes(site==='sanjipick'?'66,000':'44,000'));
      for (const period of [undefined,'today','week','month']) {
        const settlement=renderToStaticMarkup(await load('app/admin/(protected)/settlements/page.tsx',mocks).default({searchParams:Promise.resolve({period})}));
        assert.ok(settlement.includes(`TEST-${own}`));assert.ok(!settlement.includes(`TEST-${other}`));
      }
    });
    await test(`${site}: profit queries use this site's sales and expenses`,async()=>{
      const result=await(await load('app/api/admin/profit/route.ts',mocks).GET(req('/api/admin/profit?site=other'))).json();
      assert.equal(result.length,1);assert.equal(result[0].gross,site==='sanjipick'?66000:44000);assert.equal(result[0].shipping_cost,site==='sanjipick'?200:100);
    });
    await test(`${site}: payout calculation writes only its own snapshot`,async()=>{
      const otherSnapshotBefore=(await db.query('SELECT payout_amount FROM influencer_payouts WHERE site=$1',[site==='sanjipick'?'blendpick':'sanjipick'])).rows[0].payout_amount;
      const p=load('app/api/admin/influencer-payouts/route.ts',mocks);
      assert.equal((await p.POST(req('/api/admin/influencer-payouts',{campaign_id:campaign,influencer_id:influencer}))).status,201);
      const ownSnapshot=(await db.query('SELECT gross_sales FROM influencer_payouts WHERE site=$1',[site])).rows[0];
      assert.equal(Number(ownSnapshot.gross_sales),site==='sanjipick'?66000:44000);
      assert.equal((await db.query('SELECT payout_amount FROM influencer_payouts WHERE site=$1',[site==='sanjipick'?'blendpick':'sanjipick'])).rows[0].payout_amount,otherSnapshotBefore);
      const patch=load('app/api/admin/influencer-payouts/[id]/route.ts',mocks);
      assert.equal((await patch.PATCH(req('/api/admin/influencer-payouts/x',{status:'paid'},'PATCH'),{params:Promise.resolve({id:id(site==='sanjipick'?80:81)})})).status,404);
    });
    await test(`${site}: order and cart payment still call Toss and save the correct site`,async()=>{
      for (const endpoint of ['shop-confirm','cart-confirm','confirm']) {
        global.fetch=async(url,opts)=>{assert.equal(url,'https://api.tosspayments.com/v1/payments/confirm');assert.equal(JSON.parse(opts.body).amount,10000);return Response.json({method:'card'});};
        const cd={productId:product,productName:'Fruit',unitPrice:10000,quantity:1,totalAmount:10000,shippingCost:0,customerName:'Test',customerPhone:'01000000000',shippingAddress:'Test',campaignId:campaign,items:[{cart_id:id(200),product_id:product,name:'Fruit',unit_price:10000,price:10000,quantity:1}]};
        const {POST}=load(`app/api/payment/${endpoint}/route.ts`,mocks);
        const result=await(await POST(req(`/api/payment/${endpoint}`,{paymentKey:`MOCK_${site}_${endpoint}`,orderId:`MOCK_${endpoint}`,amount:10000,checkoutData:cd}))).json();
        assert.equal(result.ok,true,JSON.stringify(result));
        const saved=(await db.query('SELECT site, order_number FROM orders WHERE payment_key=$1',[`MOCK_${site}_${endpoint}`])).rows[0];
        assert.equal(saved.site,site);assert.ok(saved.order_number.startsWith(site==='sanjipick'?'SJ-':'BP-'));
      }
      global.fetch=async()=>{httpCalls++;throw Error('Unexpected external request');};
    });
  }
  site='sanjipick';
  await test('Sanji hotel endpoints and navigation are unavailable',async()=>{
    const res=proxy(new NextRequest('https://sanjipick.blendpunch.com/api/admin/reservations',{headers:{host:'sanjipick.blendpunch.com'}}));assert.equal(res.status,404);
    const hotel=load('app/api/admin/reservations/route.ts',mocks);assert.equal((await hotel.GET(req('/api/admin/reservations'))).status,404);
    const Sidebar=load('components/admin/AdminSidebar.tsx',mocks).default;
    const html=renderToStaticMarkup(React.createElement(Sidebar,{siteKey:'sanjipick'}));assert.match(html,/SANJI PICK/);assert.doesNotMatch(html,/예약 관리/);
    const shop=renderToStaticMarkup(React.createElement(Sidebar,{siteKey:'blendpick'}));assert.match(shop,/예약 관리/);
  });
  await test('site-signed extra-payment link is rejected on the other site before Toss',async()=>{
    const {signPayLink,verifyPayLink}=load('lib/pay-link.ts');
    const token=await signPayLink(10000,'Extra','sanjipick');assert.equal((await verifyPayLink(token)).site,'sanjipick');
    assert.equal((await verifyPayLink(await signPayLink(10000,'Legacy'))).site,'blendpick');
    site='blendpick';const {POST}=load('app/api/payment/extra-confirm/route.ts',mocks);
    assert.equal((await POST(req('/api/payment/extra-confirm',{token,amount:10000}))).status,400);assert.equal(httpCalls,0);
  });
  console.log(`${passed} checks passed against isolated PostgreSQL. No production payments or notifications.`);
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{global.fetch=http;await db.close();});
