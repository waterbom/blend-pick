// Isolated authentication regression tests: no production DB or external calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
function load(file, mocks) {
  const full = path.join(root, file);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: full,
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) throw Error(`Unmocked dependency: ${name}`);
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const jose = await import('jose');
  process.env.ADMIN_JWT_SECRET = 'isolated-test-admin-secret-not-for-production';
  const auth = load('lib/auth.ts', { jose });
  const admin = { id: 'admin-1', email: 'admin@blendpick.com', name: 'Admin' };
  let count = 0;
  async function test(name, run) { await run(); count++; console.log(`PASS ${name}`); }
  const signed = (payload, expires = '1h', key = process.env.ADMIN_JWT_SECRET) => new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(expires).sign(new TextEncoder().encode(key));
  await test('designated admin token is accepted', async () => assert.deepEqual(await auth.verifyAdminToken(await auth.signAdminToken(admin)), admin));
  await test('other-email token cannot be issued or accepted even with a valid signature', async () => {
    const other = { ...admin, email: 'personal@example.com' };
    assert.equal(await auth.signAdminToken(other), null);
    assert.equal(await auth.verifyAdminToken(await signed(other)), null);
  });
  await test('customer tokens cannot authorize admin even with admin email and role', async () => {
    assert.equal(await auth.verifyAdminToken(await auth.signToken({ ...admin, role: 'admin' })), null);
  });
  await test('expired, malformed and public-default-key tokens are rejected', async () => {
    for (const token of [await signed(admin, '-1s'), await signed({ email: admin.email }), await signed(admin, '1h', 'blend-admin-secret-2026'), 'invalid']) assert.equal(await auth.verifyAdminToken(token), null);
  });
  await test('missing or old default admin secret disables admin authentication', async () => {
    const secret = process.env.ADMIN_JWT_SECRET;
    const token = await auth.signAdminToken(admin);
    for (const invalid of ['', 'blend-admin-secret-2026']) {
      process.env.ADMIN_JWT_SECRET = invalid;
      assert.equal(await auth.verifyAdminToken(token), null);
      assert.equal(await auth.signAdminToken(admin), null);
    }
    process.env.ADMIN_JWT_SECRET = secret;
  });
  const mocks = {
    '@/lib/auth': auth,
    '@/lib/db': { query: async () => ({ rows: [{ id: 'personal-1', role: 'customer', name: 'Personal', password_hash: 'mock', is_verified: true, is_active: true }] }) },
    '@/lib/db-shop': { query: async () => ({ rows: [{ ...admin, password_hash: 'mock' }] }) },
    bcryptjs: { compare: async password => password === 'correct' },
  };
  const login = load('app/api/auth/login-email/route.ts', mocks).POST;
  const req = (email, password = 'correct') => new NextRequest('https://sanjipick.blendpunch.com/api/auth/login-email', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'admin_token=previous-admin; shop_token=previous-customer' }, body: JSON.stringify({ email, password }) });
  await test('personal login removes the previous admin cookie', async () => {
    const res = await login(req('personal@example.com'));
    assert.equal(res.status, 200);
    assert.equal(res.cookies.get('admin_token').maxAge, 0);
    assert.equal((await auth.verifyToken(res.cookies.get('shop_token').value)).id, 'personal-1');
  });
  await test('header reproduces stale-admin display and shows personal mode after account switch', async () => {
    const jar = { admin_token: await auth.signAdminToken(admin), shop_token: await auth.signToken({ id: 'personal-1', role: 'customer' }) };
    const header = load('components/Header.tsx', { '@/lib/auth': auth, '@/lib/db': mocks['@/lib/db'], 'next/headers': { cookies: async () => ({ get: key => jar[key] ? { value: jar[key] } : undefined }) }, '@/lib/site-server': { currentSite: async () => ({ key: 'sanjipick', nameEn: 'SANJI PICK', basePath: '/sanji' }) }, '@/lib/sanji-link': { sanjiLinkBase: async () => '' }, '@/components/HeaderClient': () => null }).default;
    assert.equal((await header()).props.isAdmin, true);
    const res = await login(req('personal@example.com'));
    for (const cookie of res.cookies.getAll()) {
      if (cookie.maxAge === 0) delete jar[cookie.name]; else jar[cookie.name] = cookie.value;
    }
    assert.equal((await header()).props.isAdmin, false);
  });
  await test('Kakao personal login clears old admin session', async () => {
    const oldFetch = global.fetch;
    global.fetch = async url => ({ json: async () => url.includes('/oauth/token') ? { access_token: 'mock-only' } : { id: 'kakao-1', kakao_account: { profile: { nickname: 'Personal' } } } });
    try {
      const callback = load('app/api/auth/kakao/callback/route.ts', mocks).GET;
      const res = await callback(new NextRequest('https://shop.blendpunch.com/api/auth/kakao/callback?code=mock'));
      assert.equal(res.cookies.get('admin_token').maxAge, 0);
      assert.equal((await auth.verifyToken(res.cookies.get('shop_token').value)).role, 'customer');
    } finally { global.fetch = oldFetch; }
  });
  await test('admin login requires password and removes previous customer cookie', async () => {
    const denied = await login(req(admin.email, 'wrong'));
    assert.equal(denied.status, 401); assert.equal(denied.cookies.get('admin_token'), undefined);
    const res = await login(req(admin.email));
    assert.deepEqual(await auth.verifyAdminToken(res.cookies.get('admin_token').value), admin);
    assert.equal(res.cookies.get('shop_token').maxAge, 0);
  });
  await test('logout clears both sessions', async () => {
    const route = load('app/api/auth/logout/route.ts', { '@/lib/site-server': { currentSite: async () => ({ key: 'sanjipick' }) }, '@/lib/sites': { SITES: { sanjipick: { host: 'sanjipick.blendpunch.com' } }, siteFromHost: () => 'sanjipick' } });
    const res = await route.GET(new NextRequest('https://sanjipick.blendpunch.com/api/auth/logout'));
    assert.equal(res.cookies.get('admin_token').maxAge, 0); assert.equal(res.cookies.get('shop_token').maxAge, 0);
  });
  await test('admin layout rejects customer-token fallback and other-email admin tokens', async () => {
    for (const cookies of [{ shop_token: await auth.signToken({ ...admin, role: 'admin' }), admin_token: 'invalid' }, { admin_token: await signed({ ...admin, email: 'personal@example.com' }) }]) {
      const layout = load('app/admin/(protected)/layout.tsx', { '@/lib/admin-site': { currentAdminSite: async () => ({ key: 'sanjipick' }) }, 'next/headers': { cookies: async () => ({ get: key => cookies[key] ? { value: cookies[key] } : undefined }) }, 'next/navigation': { redirect: url => { throw Error(`REDIRECT:${url}`); } }, '@/lib/auth': auth, '@/components/admin/AdminSidebar': () => null }).default;
      await assert.rejects(() => layout({ children: null }), /REDIRECT:\/login/);
    }
  });
  await test('protected API denies foreign-email signed admin token before DB access', async () => {
    const token = await signed({ ...admin, email: 'personal@example.com' });
    const route = load('app/api/admin/categories/route.ts', { '@/lib/auth': auth, 'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) }, '@/lib/db-shop': { query: async () => { throw Error('Unauthorized DB access'); } } });
    assert.equal((await route.GET()).status, 401);
  });
  console.log(`${count} authentication checks passed. No production access.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
