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
    if (name.startsWith('@/') && name.endsWith('.cjs')) return require(path.join(root,name.slice(2)));
    if (name.startsWith('@/')) return load(['.ts', '.tsx'].map(ext => name.slice(2) + ext).find(f => fs.existsSync(path.join(root, f))), mocks, cache);
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(localRequire, mod, mod.exports);
  return mod.exports;
}
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
const pool = { query: async (sql, params) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }, connect: async () => ({ query: pool.query, release() {} }) };
const sites = load('lib/sites.ts').SITES;
let site = 'sanjipick';
const user = id(1), product = id(2), option = id(3);
const oldFetch = global.fetch, oldEnv = process.env.NODE_ENV;
let external = 0;
const mocks = {
  '@/lib/db-shop': pool,
  '@/lib/db': { query: async () => ({ rows: [{ id: user, role: 'customer', is_active: true }] }) },
  '@/lib/auth': { verifyToken: async () => ({ id: user }), signToken: async () => 'mock-session-token' },
  '@/lib/site-server': { currentSite: async () => ({ key: site }) },
  'next/headers': { cookies: async () => ({ get: key => key === 'shop_token' ? { value: 'mock-user' } : undefined }) },
  '@/lib/phone-verify': { isPhoneVerified: async () => true }, '@/lib/sms': { phoneVerifyOn: () => false },
  '@/lib/sale-window': { findClosedSaleProduct: async () => null }, '@/lib/inf-ref': { infRefFromCookie: async () => null },
};
let count = 0;
async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
function req(siteKey, path, cookie = '', body) {
  return new NextRequest(`https://${sites[siteKey].host}${path}`, { method: body ? 'POST' : 'GET', headers: { host: sites[siteKey].host, cookie, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
(async () => {
  await db.exec(`
    CREATE TABLE products_shop (id uuid PRIMARY KEY, name text, brand text, price integer, main_image text, shipping_type text, shipping_cost integer, free_shipping_threshold integer, per_unit_shipping_cost integer, status text, stock integer, supplier_name text, release_address text, shipping_carrier text);
    CREATE TABLE product_options (id uuid PRIMARY KEY, name text, value text, extra_price integer);
    CREATE TABLE cart (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, product_id uuid, option_id uuid, quantity integer, created_at timestamptz DEFAULT NOW(), UNIQUE(user_id, product_id, option_id));
    INSERT INTO products_shop (id, name) VALUES ('${product}', 'Fruit');
    INSERT INTO product_options (id, name) VALUES ('${option}', 'Box');
    INSERT INTO cart (user_id, product_id, option_id, quantity) VALUES ('${user}','${product}','${option}',2);
  `);
  const sql = fs.readFileSync(path.join(root, 'scripts/storefront-site.sql'), 'utf8');
  await test('migration preserves legacy Shop cart and can run twice', async () => {
    await db.exec('BEGIN;'+sql+'COMMIT;'); await db.exec('BEGIN;'+sql+'COMMIT;');
    assert.equal((await db.query('SELECT site FROM cart')).rows[0].site, 'blendpick');
  });
  const cart = load('app/api/cart/route.ts', mocks);
  let sanjiCart, shopCart;
  await test('same member and option get independent carts on each site', async () => {
    assert.equal((await cart.POST(req(site, '/api/cart', '', { product_id: product, option_id: option, quantity: 3 }))).status, 200);
    sanjiCart = (await (await cart.GET()).json()).items[0]; assert.equal(sanjiCart.quantity, 3);
    site = 'blendpick'; shopCart = (await (await cart.GET()).json()).items[0]; assert.equal(shopCart.quantity, 2);
    assert.notEqual(shopCart.id, sanjiCart.id);
  });
  await test('cross-site quantity changes and deletion are rejected', async () => {
    assert.equal((await cart.PATCH(req(site,'/api/cart','',{cart_id:sanjiCart.id,quantity:9}))).status,404);
    assert.equal((await cart.DELETE(req(site,'/api/cart','',{cart_id:sanjiCart.id}))).status,404);
    assert.equal((await cart.PATCH(req(site,'/api/cart','',{cart_id:shopCart.id,quantity:4}))).status,200);
  });
  await test('optionless cart additions merge within the same site only', async () => {
    for (site of ['blendpick','sanjipick']) {
      for (let i=0;i<2;i++) await cart.POST(req(site,'/api/cart','',{product_id:product,quantity:1}));
      const rows = (await (await cart.GET()).json()).items.filter(x => !x.option_id);
      assert.equal(rows.length,1);assert.equal(rows[0].quantity,2);
    }
  });
  process.env.NODE_ENV = 'production';
  global.fetch = async () => { external++; throw Error('External request must be mocked'); };
  await test('foreign-site cart checkout is rejected before Toss approval', async () => {
    const confirm = load('app/api/payment/cart-confirm/route.ts',mocks).POST;
    const res=await confirm(req('sanjipick','/api/payment/cart-confirm','',{checkoutData:{items:[{id:shopCart.id,product_id:product}]}}));
    assert.equal(res.status,400);assert.equal(external,0);
  });
  await test('Shop preview paths redirect to canonical Sanji and cookie cannot change payment site', async () => {
    const proxy=load('proxy.ts').proxy;
    const res=proxy(req('blendpick','/sanji/p/fruit?qty=2','sj_preview=1'));
    assert.equal(res.headers.get('location'),`https://${sites.sanjipick.host}/p/fruit?qty=2`);
    const shop=proxy(req('blendpick','/api/payment/cart-confirm','sj_preview=1'));
    assert.equal(shop.headers.get('x-middleware-request-x-site'),'blendpick');
    const siteOf=load('lib/site-request.ts').siteFromRequest;
    assert.equal(siteOf(new Request('https://shop.blendpunch.com',{headers:{host:'shop.blendpunch.com','x-site':'sanjipick'}})),'blendpick');
  });
  process.env.KAKAO_CLIENT_ID='mock-client';process.env.KAKAO_REDIRECT_URI='https://shop.blendpunch.com/api/auth/kakao/callback';
  const start=load('app/api/auth/kakao/route.ts',mocks).GET;
  const callback=load('app/api/auth/kakao/callback/route.ts',mocks).GET;
  const complete=load('app/api/auth/kakao/complete/route.ts',mocks).GET;
  global.fetch=async url=>{ external++;return {ok:true,json:async()=>url.includes('/oauth/token')?{access_token:'mock-only'}:{id:'kakao-user',kakao_account:{profile:{nickname:'Buyer'}}}}; };
  async function begin(key, destination='/cart') {
    const res=await start(req(key,`/api/auth/kakao?redirect=${encodeURIComponent(destination)}`));
    const url=new URL(res.headers.get('location'));const state=url.searchParams.get('state');
    assert.equal(url.searchParams.get('redirect_uri'),process.env.KAKAO_REDIRECT_URI);
    assert.equal(res.cookies.get('kakao_login_flow').domain,'.blendpunch.com');
    return {state,cookie:`kakao_login_flow=${state}`};
  }
  await test('Sanji OAuth returns via one-time handoff and issues a host-only Sanji session',async()=>{
    const f=await begin('sanjipick');
    const r=await callback(req('blendpick',`/api/auth/kakao/callback?code=ok&state=${f.state}`,f.cookie));
    const target=new URL(r.headers.get('location'));
    assert.equal(target.host,sites.sanjipick.host);assert.equal(target.pathname,'/api/auth/kakao/complete');
    assert.equal(r.cookies.get('shop_token'),undefined);assert.ok(!target.href.includes('mock-session-token'));
    const wrong=await complete(req('blendpick',target.pathname+target.search,f.cookie));assert.equal(wrong.cookies.get('shop_token'),undefined);
    const noCookie=await complete(req('sanjipick',target.pathname+target.search));assert.equal(noCookie.cookies.get('shop_token'),undefined);
    const done=await complete(req('sanjipick',target.pathname+target.search,f.cookie));
    assert.equal(done.headers.get('location'),`https://${sites.sanjipick.host}/cart`);
    assert.equal(done.cookies.get('shop_token').value,'mock-session-token');assert.equal(done.cookies.get('shop_token').domain,undefined);
    assert.equal(done.cookies.get('admin_token').maxAge,0);
    const again=await complete(req('sanjipick',target.pathname+target.search,f.cookie));assert.equal(again.cookies.get('shop_token'),undefined);
  });
  await test('Shop OAuth stays on Shop and returns to original internal destination',async()=>{
    const f=await begin('blendpick','/cart/checkout');
    const r=await callback(req('blendpick',`/api/auth/kakao/callback?code=ok&state=${f.state}`,f.cookie));
    assert.equal(r.headers.get('location'),`https://${sites.blendpick.host}/cart/checkout`);assert.equal(r.cookies.get('shop_token').domain,undefined);
  });
  await test('missing, mismatched, expired and reused OAuth states fail before provider calls',async()=>{
    const f=await begin('sanjipick');let before=external;
    const bad=await callback(req('blendpick',`/api/auth/kakao/callback?code=ok&state=${f.state}`,'kakao_login_flow=wrong'));
    assert.equal(bad.cookies.get('shop_token'),undefined);assert.equal(external,before);
    await db.query("UPDATE oauth_login_flows SET expires_at=NOW()-INTERVAL '1 second'");
    await callback(req('blendpick',`/api/auth/kakao/callback?code=ok&state=${f.state}`,f.cookie));assert.equal(external,before);
    const g=await begin('blendpick');const path=`/api/auth/kakao/callback?code=ok&state=${g.state}`;
    await callback(req('blendpick',path,g.cookie));before=external;await callback(req('blendpick',path,g.cookie));assert.equal(external,before);
  });
  await test('handoff expires and cannot establish a session after its deadline',async()=>{
    const f=await begin('sanjipick');const r=await callback(req('blendpick',`/api/auth/kakao/callback?code=ok&state=${f.state}`,f.cookie));
    const target=new URL(r.headers.get('location'));await db.query("UPDATE oauth_login_handoffs SET expires_at=NOW()-INTERVAL '1 second'");
    const done=await complete(req('sanjipick',target.pathname+target.search,f.cookie));assert.equal(done.cookies.get('shop_token'),undefined);
  });
  await test('external return destinations are rejected',async()=>{
    const safe=load('lib/kakao-login.ts',mocks).safeReturnPath;
    for(const p of ['//evil.example','https://evil.example','/\\evil.example','/api/auth/kakao/complete?code=x'])assert.equal(safe(p),'/');
    assert.equal(safe('/cart?selected=1'),'/cart?selected=1');
  });
  console.log(`${count} storefront separation checks passed. No live OAuth or payments.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=oldFetch;if(oldEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnv;await db.close();});
