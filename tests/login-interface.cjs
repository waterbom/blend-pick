const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { load } = require('./support/load.cjs');
const { internalReturnPath } = load('lib/buyer-flow.ts');
const { safeReturnPath } = load('lib/kakao-login.ts', { '@/lib/db-shop': {} });

test('login destinations reject browser-normalized external URLs and control characters', () => {
  for (const path of ['/\t/evil.invalid', '/\t\t/evil.invalid', '/\r/evil.invalid', '/\n/evil.invalid', '/\\evil.invalid', '//evil.invalid', 'https://evil.invalid', '/products\u0000/test', '/products\u007f/test', null]) {
    assert.equal(internalReturnPath(path), '/', JSON.stringify(path));
    assert.equal(safeReturnPath(path), '/', JSON.stringify(path));
  }
  for (const path of ['/products/123?inf=partner#options', '/sanji/p/123', '/cart/checkout', '/mypage']) {
    assert.equal(internalReturnPath(path), path);
    assert.equal(safeReturnPath(path), path);
  }
  assert.equal(safeReturnPath('/products/../api/auth/logout'), '/');
  assert.equal(safeReturnPath('/api/auth'), '/');
  assert.equal(safeReturnPath('/api/auth/kakao?redirect=/'), '/');
});

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}

function mount(t, fetcher, redirect = '') {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: '/login', search: '' } };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  t.mock.method(globalThis, 'fetch', fetcher);
  const states = [' buyer@example.com ', ' password with spaces ', false, '', redirect];
  const pending = { current: false };
  let cursor = 0;
  const Page = load('app/login/page.tsx', {
    react: { ...React, useEffect() {}, useRef: () => pending, useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    } },
    'next/link': props => React.createElement('a', props),
    '@/components/SiteContext': { BrandMark: () => null },
  }).default;
  const render = () => { cursor = 0; return Page(); };
  const form = () => find(render(), node => node.type === 'form');
  return { states, render, form, submit: () => form().props.onSubmit({ preventDefault() {} }) };
}

test('network failure restores the button and preserves the entered credentials', async t => {
  const ui = mount(t, async () => { throw new TypeError('Failed to fetch'); });
  await ui.submit();
  assert.equal(ui.form().props['aria-busy'], false);
  assert.equal(find(ui.render(), node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
  assert.match(ui.states[3], /NETWORK_ERROR/);
  assert.equal(ui.states[0], ' buyer@example.com ');
  assert.equal(ui.states[1], ' password with spaces ');
  assert.equal(window.location.href, '/login');
});

test('HTML or incomplete JSON responses show an actionable error and allow another attempt', async t => {
  let attempts = 0;
  const ui = mount(t, async () => ++attempts === 1
    ? new Response('<html>private-gateway-reply</html>', { status: 502 })
    : Response.json({}));
  await ui.submit();
  assert.match(ui.states[3], /RESPONSE_INVALID/);
  assert.doesNotMatch(ui.states[3], /private-gateway-reply/);
  await ui.submit();
  assert.equal(attempts, 2);
  assert.match(ui.states[3], /로그인 결과/);
  assert.equal(ui.form().props['aria-busy'], false);
  assert.equal(window.location.href, '/login');
});

test('a second submit is ignored until the first request finishes', async t => {
  let finish, calls = 0;
  const ui = mount(t, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = ui.submit();
  await ui.submit();
  assert.equal(calls, 1);
  assert.equal(ui.form().props['aria-busy'], true);
  finish(Response.json({ ok: false, error: '이메일 또는 비밀번호를 확인해주세요.' }, { status: 401 }));
  await first;
  assert.equal(ui.form().props['aria-busy'], false);
  const alert = find(ui.render(), node => node.props?.role === 'alert');
  assert.equal(alert.props.id, 'login-error');
  assert.match(ui.states[3], /이메일 또는 비밀번호/);
});

test('successful customer login preserves attribution and trims only the email', async t => {
  let body;
  const ui = mount(t, async (_url, options) => { body = JSON.parse(options.body); return Response.json({ ok: true }); }, '/products/123?inf=partner');
  await ui.submit();
  assert.deepEqual(body, { email: 'buyer@example.com', password: ' password with spaces ' });
  assert.equal(window.location.href, '/products/123?inf=partner');
});

test('a server-provided redirect is also constrained to this storefront', async t => {
  const ui = mount(t, async () => Response.json({ ok: true, redirect: '/\t/evil.invalid' }));
  await ui.submit();
  assert.equal(window.location.href, '/');
});

test('admin login retains its existing destination and fields have associated labels', async t => {
  const ui = mount(t, async () => Response.json({ ok: true, isAdmin: true }), '/cart');
  for (const id of ['login-email', 'login-password']) {
    assert.ok(find(ui.render(), node => node.type === 'label' && node.props.htmlFor === id));
    assert.ok(find(ui.render(), node => node.type === 'input' && node.props.id === id));
  }
  await ui.submit();
  assert.equal(window.location.href, '/admin');
});
