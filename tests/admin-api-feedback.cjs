const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { load } = require('./support/load.cjs');
const { readApiJson, apiErrorMessage } = load('lib/api-error-message.ts');
const requestId = '00000000-0000-4000-8000-000000000001';
const failure = { error: '다른 처리로 상태가 바뀌었습니다.', code: 'STATE_CONFLICT', action: '현재 처리 결과를 먼저 확인해주세요.', requestId };
const event = { preventDefault() {}, stopPropagation() {} };
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)];
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : React.Children.toArray(n.props?.children).map(text).join('');
const product = { id: 'product', name: '테스트 상품', brand: '테스트', category: '생활', price: 1000, supply_price: 500, stock: 10, status: 'active', shipping_type: 'free', updated_at: '2026-10-01T00:00:00Z' };
const member = { id: 'member', name: '테스트 회원', email: 'test@example.invalid', role: 'influencer', role_status: 'pending', is_active: true, orders: 0, spent: 0, cancels: 0, returns: 0 };
const reservation = { id: 'reservation', order_number: 'BP-test', status: 'paid', buyer_name: '테스트 예약자', buyer_phone: '01000000000', stay_check_in: '2026-10-10', stay_check_out: '2026-10-11', total_amount: 100000, extra_paid: 0, product_name: 'UTOP · 2인 패키지 · 패밀리 트윈' };
const fixtures = {
  '/api/admin/campaigns': [{ id: 'campaign', product_name: '테스트 공구', influencer_name: '테스트', start_date: '2026-10-01', end_date: '2026-10-30', costs_total: 0 }],
  '/api/admin/campaigns/campaign': { commission_rate: 10, supply_price: 500, costs: [{ id: 'cost', category: 'ad', amount: 100, memo: '' }] },
  '/api/admin/influencers/influencer': { id: 'influencer', name: '테스트 인플루언서', campaigns: [] },
  '/api/admin/products': [product], '/api/admin/products/product': product,
  '/api/admin/categories': [{ id: 'category', name: '생활' }],
  '/api/admin/members': { members: [member] }, '/api/admin/members/member': { orders: [], reviewCount: 0 },
  '/api/admin/reservations': [reservation], '/api/admin/reservations/notify': { pending: 1 },
  '/api/admin/shipments/carriers': { carriers: [] },
  '/api/admin/reviews': [{ id: 'review', product_name: '테스트 상품', buyer_name: '작성자', content: '리뷰', rating: 5, is_hidden: false, created_at: '2026-10-01' }],
};
function mount(t, component, props = {}) {
  const state = [], effects = [], messages = [], routes = [], requests = [];
  let cursor = 0, result = () => Response.json({ ok: true });
  const react = { ...React,
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; },
    useRef(initial) { const i = cursor++; return state[i] ??= { current: initial }; },
    useEffect(fn) { effects.push(fn); }, useMemo: fn => fn(), useCallback: fn => fn,
    useContext: ctx => ctx._currentValue,
  };
  const previous = Object.fromEntries(['window', 'alert', 'confirm', 'fetch', 'location', 'localStorage'].map(k => [k, global[k]]));
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } });
  global.alert = message => messages.push(String(message));
  global.confirm = () => true;
  global.location = { hostname: 'shop.blendpunch.com' };
  global.localStorage = { getItem: () => null };
  global.window = { confirm: global.confirm, location: { origin: 'https://test.invalid' }, open: url => routes.push(url) };
  global.fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (options.method && options.method !== 'GET') return result(url, options);
    return Response.json(fixtures[String(url).split('?')[0]] ?? []);
  };
  t.mock.method(global, 'setTimeout', () => 1);
  const View = load(component, {
    react, 'next/navigation': { useRouter: () => ({ push: url => routes.push(url), refresh: () => routes.push('refresh'), back() {} }) },
    '@/components/SiteContext': { useSiteKey: () => 'blendpick' },
    '@/components/CopyLinkButton': () => null, '@/components/admin/RichEditor': () => null,
    './RoomInventoryClient': () => null,
  }).default;
  const render = () => { cursor = 0; effects.length = 0; return View(props); };
  const find = predicate => { const found = nodes(render()).find(predicate); assert.ok(found, 'Expected UI control'); return found; };
  const button = label => find(n => n.type === 'button' && text(n).includes(label));
  const click = async label => { await button(label).props.onClick(event); await flush(); };
  return { render, find, button, click, messages, routes, requests,
    async init() { render(); for (const effect of [...effects]) effect(); await flush(); requests.length = 0; messages.length = 0; },
    respond(fn) { result = fn; },
    async submit() { await find(n => n.type === 'form' && n.props.onSubmit).props.onSubmit(event); await flush(); },
    feedback() { return [...messages, text(render())].join('\n'); },
  };
}
const scenarios = [
  { name: 'campaign save', component: 'CampaignsClient',
    async prepare(f) { await f.find(n => n.props?.onClick && text(n).includes('테스트 공구')).props.onClick(); },
    run: f => f.click('저장'), busy: '저장', method: 'PUT', success: () => Response.json({ ok: true }),
    verify(f) { assert.match(f.messages.join(' '), /저장되었습니다/); } },
  { name: 'campaign add cost', component: 'CampaignsClient',
    async prepare(f) { await f.find(n => n.props?.onClick && text(n).includes('테스트 공구')).props.onClick(); f.find(n => n.props?.placeholder === '금액').props.onChange({ target: { value: '250' } }); },
    run: f => f.click('추가'), method: 'POST', success: () => Response.json({ id: 'cost-new' }),
    verify(f) { assert.match(text(f.render()), /250원/); } },
  { name: 'influencer save', component: 'InfluencerFormClient', props: { mode: 'edit', influencerId: 'influencer' },
    run: f => f.submit(), busy: '저장', method: 'PUT', success: () => Response.json({ ok: true }),
    verify(f) { assert.deepEqual(f.routes, ['/admin/influencers', 'refresh']); } },
  { name: 'influencer account issue', component: 'InfluencerFormClient', props: { mode: 'edit', influencerId: 'influencer' },
    run: f => f.click('아이디/비밀번호 발급'), busy: '아이디/비밀번호 발급', method: 'POST', success: () => Response.json({ login_id: 'issued', password: 'test-password' }),
    verify(f) { assert.match(text(f.render()), /issued/); } },
  { name: 'member approval', component: 'MembersClient',
    async prepare(f) { await f.find(n => n.type === 'tr' && n.props.onClick).props.onClick(); },
    run: f => f.click('신청 승인'), busy: '신청 승인', method: 'PATCH', success: () => Response.json({ ok: true }),
    verify(f) { assert.ok(f.requests.some(r => !r.method && r.url.startsWith('/api/admin/members'))); } },
  { name: 'product save', component: 'ProductFormClient', props: { mode: 'edit', productId: 'product' },
    run: f => f.submit(), method: 'PATCH', success: () => Response.json({ id: 'product', updated_at: 'new' }),
    verify(f) { assert.deepEqual(f.routes, ['/admin/products', 'refresh']); } },
  { name: 'product archive', component: 'ProductFormClient', props: { mode: 'edit', productId: 'product' },
    run: f => f.click('삭제'), method: 'DELETE', success: () => Response.json({ ok: true }),
    verify(f) { assert.deepEqual(f.routes, ['/admin/products', 'refresh']); } },
  { name: 'reservation notification', component: 'ReservationsClient',
    run: f => f.click('문자'), method: 'POST', success: () => Response.json({ ok: true, sent: 1, failed: 0, total: 1 }),
    verify(f) { assert.match(f.messages.join(' '), /성공 1건/); } },
  { name: 'reservation status change', component: 'ReservationsClient',
    async run(f) { await f.find(n => n.type === 'select' && n.props.title === '상태 변경').props.onChange({ target: { value: 'checked_in' } }); },
    method: 'PATCH', success: () => Response.json({ ok: true }),
    verify(f) { assert.equal(f.find(n => n.props?.title === '상태 변경').props.value, 'checked_in'); },
    failureVerify(f) { assert.equal(f.find(n => n.props?.title === '상태 변경').props.value, 'paid'); } },
  { name: 'reservation date preview', component: 'ReservationsClient',
    prepare: f => f.click('예약변경'), run: f => f.click('차액 확인'), busy: '차액 확인',
    method: 'POST', success: () => Response.json({ ok: true, diff: 0, oldTotal: 100000, newTotal: 100000, nights: 1, pkgLabel: '2인', room: '패밀리 트윈', available: true, minRemaining: 1 }),
    verify(f) { assert.ok(f.button('변경 확정')); } },
  { name: 'tracking save', component: 'TrackingForm', props: { orderId: 'order', currentStatus: 'preparing', trackingCompany: '04', trackingNumber: '123456789012' },
    run: f => f.click('운송장 등록'), busy: '운송장 등록', method: 'PATCH', success: () => Response.json({ ok: true }),
    verify(f) { assert.deepEqual(f.routes, ['refresh']); assert.match(text(f.render()), /저장됐어요/); } },
  { name: 'tracking status change', component: 'TrackingForm', props: { orderId: 'order', currentStatus: 'shipped', trackingCompany: '04', trackingNumber: '123456789012' },
    run: f => f.click('배송완료 처리'), busy: '배송완료 처리', method: 'PATCH', success: () => Response.json({ ok: true }),
    verify(f) { assert.deepEqual(f.routes, ['refresh']); } },
];
for (const scenario of scenarios) {
  for (const mode of ['conflict', 'server', 'html', 'network', 'success']) {
    test(`${scenario.name}: ${mode} is handled without losing feedback or replaying the write`, async t => {
      const f = mount(t, `components/admin/${scenario.component}.tsx`, scenario.props);
      await f.init();
      await scenario.prepare?.(f);
      f.requests.length = 0;
      f.respond(() => {
        if (mode === 'success') return scenario.success();
        if (mode === 'network') throw new TypeError('Failed to fetch');
        if (mode === 'html') return new Response('<html>private upstream diagnostic</html>', { status: 502, headers: { 'X-Request-ID': requestId } });
        return Response.json(mode === 'server' ? { ...failure, code: 'DB_UNAVAILABLE' } : failure, { status: mode === 'server' ? 503 : 409 });
      });
      await scenario.run(f);
      const writes = f.requests.filter(r => r.method && r.method !== 'GET');
      assert.equal(writes.length, 1);
      assert.equal(writes[0].method, scenario.method);
      if (mode === 'success') scenario.verify(f);
      else {
        const feedback = f.feedback();
        assert.match(feedback, new RegExp(mode === 'html' ? 'RESPONSE_INVALID' : mode === 'network' ? 'NETWORK_ERROR' : mode === 'server' ? 'DB_UNAVAILABLE' : 'STATE_CONFLICT'));
        assert.match(feedback, /처리 결과/);
        if (mode !== 'network') assert.ok(feedback.includes(requestId));
        assert.doesNotMatch(feedback, /private upstream diagnostic|Unexpected token|Failed to fetch/);
        assert.deepEqual(f.routes, []);
        if (scenario.busy) assert.ok(!f.button(scenario.busy).props.disabled);
        scenario.failureVerify?.(f);
      }
    });
  }
}

test('readApiJson preserves successful arrays, objects, 204 and inspectable partial results', async () => {
  for (const value of [[], [{ id: 'a' }], { ok: true, id: 'new' }, { ok: false, updated: 2, ...failure }]) {
    assert.deepEqual(await readApiJson(Response.json(value)), value);
  }
  assert.deepEqual(await readApiJson(new Response(null, { status: 204 }), '실패'), {});
  await assert.rejects(readApiJson(Response.json({ ok: false, ...failure }), '실패'), e => e.message.includes(requestId));
});
test('invalid response bodies and unsafe request IDs never leak raw content', async () => {
  for (const body of ['null', 'false', '"private diagnostic"', '<html>private diagnostic</html>']) {
    await assert.rejects(readApiJson(new Response(body, { status: 502, headers: { 'X-Request-ID': 'private diagnostic' } })), e => /RESPONSE_INVALID/.test(e.message) && !/private diagnostic/.test(e.message));
  }
  assert.match(apiErrorMessage(new DOMException('private detail', 'AbortError')), /NETWORK_ERROR/);
  for (const status of [401, 413]) await assert.rejects(readApiJson(new Response('<html/>', { status })), e => e.message.includes(status === 401 ? '로그인' : '파일 크기'));
});

for (const component of ['CampaignsClient', 'InfluencerFormClient', 'MembersClient', 'ProductFormClient', 'ReservationsClient', 'TrackingForm']) {
  test(`${component}: failed initial reads show server guidance and finish loading`, async t => {
    const f = mount(t, `components/admin/${component}.tsx`, { mode: 'edit', influencerId: 'influencer', productId: 'product', orderId: 'order', currentStatus: 'preparing' });
    global.fetch = async () => Response.json({ ...failure, code: 'AUTH_REQUIRED' }, { status: 401 });
    f.render();
    // init clears alerts so inspect each displayed alert separately as it occurs.
    const seen = [];
    global.alert = message => seen.push(String(message));
    await f.init();
    const output = [...seen, f.feedback()].join(' ');
    assert.match(output, /AUTH_REQUIRED/);
    assert.ok(output.includes(requestId));
    assert.doesNotMatch(text(f.render()), /불러오는 중/);
    assert.deepEqual(f.routes, []);
  });
}
test('product authentication failure keeps draft values and detailed re-login advice', async t => {
  const f = mount(t, 'components/admin/ProductFormClient.tsx', { mode: 'edit', productId: 'product' });
  await f.init();
  f.respond(() => Response.json({ ...failure, code: 'AUTH_REQUIRED' }, { status: 401 }));
  await f.submit();
  assert.match(f.feedback(), /새 탭.*관리자 로그인/);
  assert.match(f.feedback(), /AUTH_REQUIRED/);
  assert.ok(f.feedback().includes(requestId));
  assert.ok(nodes(f.render()).some(n => n.type === 'input' && n.props.value === product.name));
  assert.equal(f.find(n => n.props?.type === 'submit').props.disabled, false);
  assert.deepEqual(f.routes, []);
});

test('shipment partial success keeps counts and support guidance after list refresh without replay', async t => {
  const f = mount(t, 'components/admin/ShipmentsClient.tsx');
  await f.init();
  const review = { rows: [], counts: { total: 2, ready: 2, already: 0, duplicate: 0, blocked: 0 } };
  f.respond(url => url.endsWith('/preview')
    ? Response.json({ ...review, token: 'preview-token', expiresAt: '2099-01-01' })
    : Response.json({ ...review, ...failure, ok: false, code: 'PARTIAL_FAILURE', succeeded: 1, alreadyApplied: 0, duplicateExcluded: 0, smsQueued: 1, failed: [{ order_number: 'BP-second', error: '상태 변경' }] }));
  await f.find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { value: '', files: [{ name: 'tracking.csv', text: async () => '주문번호,운송장번호,택배사\nBP-first,123456789012,04\nBP-second,123456789013,04' }] } });
  await f.click('등록 전 미리보기');
  await f.click('정상 2건 등록');
  assert.match(f.feedback(), /신규 1건/);
  assert.match(f.feedback(), /확인 필요 1행/);
  assert.match(f.feedback(), /PARTIAL_FAILURE/);
  assert.ok(f.feedback().includes(requestId));
  assert.equal(f.requests.filter(r => r.url === '/api/admin/shipments/import').length, 1);
  assert.ok(f.requests.some(r => !r.method && r.url.startsWith('/api/admin/orders')));
});
