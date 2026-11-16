// JS하우스 페이지·API·문자 문구 검증 — DB·네트워크 없이 모듈을 직접 불러 확인한다.
const { test } = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');
const core = require('../lib/jshouse-core.cjs');
const { guestMessage, operatorMessage } = require('../lib/jshouse-messages.cjs');

const link = ({ children, href, prefetch, ...props }) => React.createElement('a', { ...props, href }, children);
const publicDefaults = core.publicConfig({ ...core.DEFAULT_CONFIG });
const sections = () => load('components/jshouse/Sections.tsx', { 'next/link': link, '@/components/jshouse/Booking': { QuickBar: () => React.createElement('button', null, '날짜 보기') } });
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));

test('price and availability maths: weekend nights, per-day overrides, missing prices', () => {
  assert.equal(core.isWeekend('2026-11-20'), true);  // 금
  assert.equal(core.isWeekend('2026-11-21'), true);  // 토
  assert.equal(core.isWeekend('2026-11-22'), false); // 일
  const priced = { ...core.DEFAULT_CONFIG, weekdayPrice: 180000, weekendPrice: 230000 };
  assert.equal(core.priceOf('2026-11-19', priced), 180000);
  assert.equal(core.priceOf('2026-11-20', priced), 230000);
  assert.equal(core.priceOf('2026-11-20', { ...priced, weekendPrice: null }), 180000);
  assert.equal(core.priceOf('2026-11-20', priced, 300000), 300000);
  assert.equal(core.priceOf('2026-11-20', core.DEFAULT_CONFIG), null);
  assert.equal(core.estimate(priced, {}, core.nightsOf('2026-11-19', '2026-11-22')).total, 640000);
  // 요금이 비어 있는 밤이 있으면 합계를 지어내지 않는다
  assert.equal(core.estimate(core.DEFAULT_CONFIG, { '2026-11-19': 200000 }, core.nightsOf('2026-11-19', '2026-11-21')).total, null);
  assert.deepEqual(core.nightsOf('2026-12-31', '2027-01-02'), ['2026-12-31', '2027-01-01']);
  assert.throws(() => core.nightsOf('2026-11-20', '2026-11-20'), /숙박 기간/);
  assert.equal(core.cleanCode(' js-ab2cd3 '), 'JS-AB2CD3');
  assert.equal(core.cleanCode('jsab2cd3'), 'JS-AB2CD3');
  assert.equal(core.today(new Date('2026-11-16T15:00:00Z')), '2026-11-17');
});

test('settings ignore unknown keys and never publish the operator phone', () => {
  const merged = core.mergeConfig({ weekdayPrice: 150000, hacked: true, notifyPhone: '01011112222' });
  assert.equal(merged.weekdayPrice, 150000); assert.equal('hacked' in merged, false);
  assert.equal('notifyPhone' in core.publicConfig(merged), false);
  assert.equal(core.validateConfig({ ...core.DEFAULT_CONFIG, notifyPhone: '010-1111-2222' }).notifyPhone, '01011112222');
  assert.throws(() => core.validateConfig({ ...core.DEFAULT_CONFIG, notifyPhone: '1234' }), /휴대폰/);
  assert.throws(() => core.validateConfig({ ...core.DEFAULT_CONFIG, windowDays: 5 }), /달력 공개 기간/);
});

test('messages state facts only: no price, address or time unless the operator set them', () => {
  const row = { code: 'JS-AB2CD3', guest_name: '김연남', guest_phone: '01012345678', check_in: '2026-11-19', check_out: '2026-11-22', guests: 3, memo: '저녁 도착', estimate: { total: null } };
  const requested = guestMessage(row, 'requested');
  assert.match(requested, /예약 신청 접수/); assert.match(requested, /JS-AB2CD3/); assert.match(requested, /2026-11-19 ~ 2026-11-22 \(3박\)/);
  assert.match(requested, /아직 예약이 확정된 것은 아닙니다/); assert.doesNotMatch(requested, /원\b|주소|입실 \d/);
  const confirmed = guestMessage({ ...row, estimate: { total: 640000 } }, 'confirmed', { checkInTime: '15:00', checkOutTime: '', address: '서울 마포구 연남동 테스트로 1' });
  assert.match(confirmed, /예약이 확정되었습니다/); assert.match(confirmed, /640,000원/); assert.match(confirmed, /입실 15:00 · 퇴실 별도 안내/); assert.match(confirmed, /테스트로 1/);
  assert.match(guestMessage(row, 'declined'), /예약이 어렵습니다/);
  assert.match(guestMessage(row, 'cancelled'), /예약이 취소되었습니다/);
  for (const kind of ['requested', 'confirmed', 'declined', 'cancelled']) assert.match(guestMessage(row, kind), /hotel\/jshouse#lookup/);
  const operator = operatorMessage(row, 'requested');
  assert.match(operator, /새 예약 신청/); assert.match(operator, /01012345678/); assert.match(operator, /요청: 저녁 도착/); assert.match(operator, /admin\/jshouse/);
  assert.match(operatorMessage(row, 'cancel_requested'), /취소 요청/);
  // 카드 결제 예약: 실제 결제금액과 환불 처리금액을 알린다
  const paidRow = { ...row, paid_at: '2026-11-16T03:00:00Z', amount: 640000, estimate: { total: 640000 } };
  const paid = guestMessage(paidRow, 'confirmed', {});
  assert.match(paid, /결제가 완료되어 예약이 확정되었습니다/); assert.match(paid, /결제금액: 640,000원/); assert.doesNotMatch(paid, /예상 숙박요금|결제와 입실 방법/);
  const refunded = guestMessage({ ...paidRow, refund_amount: 320000 }, 'cancelled');
  assert.match(refunded, /환불 처리금액: 320,000원/); assert.match(refunded, /카드사에 따라/);
  assert.doesNotMatch(guestMessage({ ...paidRow, refund_amount: 0 }, 'cancelled'), /카드사에 따라/);
  assert.doesNotMatch(guestMessage(row, 'cancelled'), /환불/);
  assert.match(operatorMessage(paidRow, 'paid'), /카드 결제 예약 확정/); assert.match(operatorMessage(paidRow, 'paid'), /결제금액: 640,000원/);
});

test('server guards: Blendpick host only, same-origin writes, verified admin token', async () => {
  let host = 'shop.blendpunch.com', token = '';
  const modules = new Map(); // 서버 모듈과 결제 연동 모듈이 같은 오류 클래스를 쓰도록 함께 불러온다
  const server = load('lib/jshouse-server.ts', {
    '@/lib/db-shop': {}, '@/lib/sms': { sendSMS: async () => ({ ok: true }), smsConfigured: () => false },
    'next/headers': { headers: async () => new Headers({ host }), cookies: async () => ({ get: () => (token ? { value: token } : undefined), set() {} }) },
    '@/lib/auth': { verifyAdminToken: async t => (t === 'valid' ? { id: '1' } : null) },
  }, modules);
  const post = origin => new Request('https://shop.blendpunch.com/api/jshouse', { method: 'POST', headers: origin ? { origin } : {} });
  await assert.rejects(server.guard(post('https://evil.example')), e => e.status === 403);
  await assert.rejects(server.guard(post()), e => e.status === 403);
  await assert.rejects(server.guard(post('not a url')), e => e.status === 403);
  await server.guard(post('https://shop.blendpunch.com'));
  await assert.rejects(server.guard(post('https://shop.blendpunch.com'), true), e => e.status === 401);
  token = 'valid'; await server.guard(post('https://shop.blendpunch.com'), true);
  host = 'sanjipick.blendpunch.com'; await assert.rejects(server.guard(), e => e.status === 404);
  // 내부 오류 내용은 응답에 실리지 않는다
  const hidden = server.failure(new Error('password=secret'));
  assert.equal(hidden.status, 503); assert.doesNotMatch(JSON.stringify(await hidden.json()), /secret/);
  assert.equal(server.failure(new core.StayError('마감', 409)).status, 409);
  // 결제 연동 오류는 손님에게 '다시 결제하지 말 것'을 안내하는 문구 그대로 전달된다
  const toss = load('lib/toss-api.ts', {}, modules);
  const payFailure = server.failure(new toss.TossError('다시 결제하지 마시고 확인해 주세요.', 503, 'PROVIDER_ERROR'));
  assert.equal(payFailure.status, 503); assert.match((await payFailure.json()).error, /다시 결제하지 마시고/);
  // 실결제 키가 둘 다 있을 때만 결제를 연다 (테스트 키·누락은 닫힘)
  const keys = { client: process.env.TOSS_CLIENT_KEY, secret: process.env.TOSS_SECRET_KEY };
  try {
    delete process.env.TOSS_CLIENT_KEY; delete process.env.TOSS_SECRET_KEY;
    assert.equal(server.paymentReady(), false);
    await assert.rejects(toss.tossPayments('/orders/x'), e => e.status === 503 && e.providerCode === undefined);
    process.env.TOSS_CLIENT_KEY = 'test_ck_x'; process.env.TOSS_SECRET_KEY = 'test_sk_x'; assert.equal(server.paymentReady(), false);
    process.env.TOSS_CLIENT_KEY = 'live_ck_x'; assert.equal(server.paymentReady(), false);
    process.env.TOSS_SECRET_KEY = 'live_sk_x'; assert.equal(server.paymentReady(), true);
  } finally {
    for (const [name, value] of [['TOSS_CLIENT_KEY', keys.client], ['TOSS_SECRET_KEY', keys.secret]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
  await assert.rejects(server.body(new Request('https://x.test', { method: 'POST', body: '[1]' })), e => e.status === 400);
  await assert.rejects(server.body(new Request('https://x.test', { method: 'POST', body: 'x'.repeat(17000) })), e => e.status === 413);
});

test('public API: phone verification gates requests and payments, notifications fire once, unknown actions are refused', async () => {
  let verifyOn = true, verified = false; const calls = { request: 0, reserve: 0, guest: [], operator: [], payment: [], confirmInput: null, reconcileOwner: null, abandonOwner: null, statusOwner: null };
  const row = { id: 'row', guest_phone: '01012345678', status: 'requested' };
  const order = extra => ({ booking: { code: 'JS-PAY234', status: 'pending' }, orderId: 'order-1', amount: 360000, payable: true, row: { id: 'order-1', guest_phone: '01012345678', owner_hash: 'secret-hash' }, changed: null, config: { notifyPhone: '01099990000' }, ...extra });
  const route = load('app/api/jshouse/route.ts', {
    '@/lib/api-errors': { withApiErrors: (_name, handler) => handler },
    '@/lib/jshouse-server': {
      stayService: {
        calendar: async () => ({ today: '2026-11-16', lastDay: '2027-05-15', config: publicDefaults, closed: [], prices: {}, taken: [], pay: true, termsKey: 'abc' }),
        mine: async () => [{ code: 'JS-AB2CD3' }],
        request: async () => { calls.request++; return { booking: { code: 'JS-AB2CD3' }, created: calls.request === 1, row, config: { notifyPhone: '01099990000' } }; },
        reserve: async () => { calls.reserve++; return order(); },
        confirm: async input => { calls.confirmInput = input; return order({ booking: { code: 'JS-PAY234', status: 'confirmed', paid: true }, payable: false, changed: 'confirmed' }); },
        reconcile: async (_id, owner) => { calls.reconcileOwner = owner; return order({ changed: null }); },
        abandon: async (_id, owner) => { calls.abandonOwner = owner; return order({ booking: { code: 'JS-PAY234', status: 'expired' }, payable: false }); },
        status: async (_id, owner) => { calls.statusOwner = owner; return order(); },
        lookup: async () => ({ booking: { code: 'JS-AB2CD3' }, row, changed: null }),
        guestCancel: async () => ({ booking: { code: 'JS-AB2CD3', status: 'cancelled' }, row: { ...row, status: 'cancelled' }, changed: true }),
        readConfig: async () => ({ notifyPhone: '01099990000' }),
      },
      guard: async () => {}, owner: async create => (create ? 'new-owner' : 'known-owner'), body: r => r.json(),
      failure: e => Response.json({ error: e.message }, { status: e.status || 500 }),
      notifyGuest: async (_row, kind) => { calls.guest.push(kind); }, notifyOperator: async (_row, kind) => { calls.operator.push(kind); },
      notifyPayment: async result => { calls.payment.push(result.changed); },
    },
    '@/lib/sms': { phoneVerifyOn: () => verifyOn },
    '@/lib/phone-verify': { isPhoneVerified: async (cookie, phone) => { assert.equal(cookie, 'verified-token'); assert.equal(phone, '01012345678'); return verified; } },
    'next/headers': { cookies: async () => ({ get: name => (name === 'phone_verified' ? { value: 'verified-token' } : undefined) }) },
  });
  const url = 'https://shop.blendpunch.com/api/jshouse';
  const post = body => new Request(url, { method: 'POST', body: JSON.stringify(body) });
  const calendar = await (await route.GET(new Request(url))).json();
  assert.equal(calendar.phoneVerify, true); assert.equal(calendar.mine.length, 1); assert.equal('notifyPhone' in calendar.config, false); assert.equal(calendar.pay, true);
  assert.equal((await route.POST(post({ action: 'request', guestPhone: '010-1234-5678' }))).status, 400); assert.equal(calls.request, 0);
  assert.equal((await route.POST(post({ action: 'reserve', guestPhone: '010-1234-5678' }))).status, 400); assert.equal(calls.reserve, 0, 'unverified phones cannot hold dates for payment either');
  verified = true;
  assert.equal((await route.POST(post({ action: 'request', guestPhone: '010-1234-5678' }))).status, 200);
  assert.deepEqual(calls.guest, ['requested']); assert.deepEqual(calls.operator, ['requested']);
  // 같은 요청 재전송(created=false)은 문자를 다시 보내지 않는다
  await route.POST(post({ action: 'request', guestPhone: '010-1234-5678' }));
  assert.deepEqual(calls.guest, ['requested']);
  // 결제 시작 — 결제창을 여는 데 필요한 값만 내보내고 내부 행은 숨긴다
  const reserved = await (await route.POST(post({ action: 'reserve', guestPhone: '010-1234-5678' }))).json();
  assert.deepEqual(Object.keys(reserved).sort(), ['amount', 'booking', 'orderId', 'payable']); assert.equal(reserved.orderId, 'order-1'); assert.equal(reserved.amount, 360000);
  // 승인은 서버가 가진 값으로만 — 화면이 보낸 다른 값은 넘기지 않는다
  const confirmed = await (await route.POST(post({ action: 'confirm', orderId: 'order-1', paymentKey: 'pk', amount: 360000, status: 'DONE', row: {} }))).json();
  assert.deepEqual(calls.confirmInput, { orderId: 'order-1', paymentKey: 'pk', amount: 360000 });
  assert.equal(confirmed.booking.status, 'confirmed'); assert.doesNotMatch(JSON.stringify(confirmed), /secret-hash|notifyPhone/);
  assert.deepEqual(calls.payment, ['confirmed']);
  await route.POST(post({ action: 'reconcile', orderId: 'order-1' })); assert.equal(calls.reconcileOwner, 'new-owner', 'guests can only re-check their own order');
  assert.equal((await (await route.POST(post({ action: 'abandon', orderId: 'order-1' }))).json()).booking.status, 'expired'); assert.equal(calls.abandonOwner, 'new-owner');
  const shown = await route.GET(new Request(url + '?order=order-1'));
  assert.equal(shown.status, 200); assert.equal(calls.statusOwner, 'known-owner'); assert.equal((await shown.json()).orderId, 'order-1');
  verifyOn = false; verified = false;
  assert.equal((await route.POST(post({ action: 'request', guestPhone: '010-1234-5678' }))).status, 200);
  const found = await route.POST(post({ action: 'lookup', code: 'JS-AB2CD3', phone: '01012345678' }));
  assert.equal(found.status, 200); assert.deepEqual(await found.json(), { code: 'JS-AB2CD3' });
  assert.equal((await route.POST(post({ action: 'cancel', code: 'JS-AB2CD3', phone: '01012345678' }))).status, 200);
  assert.deepEqual(calls.guest.slice(-1), ['cancelled']); assert.deepEqual(calls.operator.slice(-1), ['guest_cancelled']);
  assert.equal((await route.POST(post({ action: 'pay' }))).status, 400);
});

test('admin API: decisions and refunds notify the guest only when something changed', async () => {
  const sent = [], payment = []; let changed = true, refundInput = null, reconciled = null;
  const admin = load('app/api/admin/jshouse/route.ts', {
    '@/lib/api-errors': { withApiErrors: (_name, handler) => handler },
    '@/lib/jshouse-server': {
      stayService: {
        admin: async () => ({ bookings: [], pay: false, termsReady: false }), saveConfig: async () => ({ ok: true }), setDays: async () => ({ ok: true }), adminCreate: async () => ({ booking: { code: 'JS-AB2CD3' } }),
        decide: async input => ({ booking: { status: 'confirmed' }, row: { status: input.action === 'confirm' ? 'confirmed' : 'declined' }, changed, config: {} }),
        refund: async input => { refundInput = input; return { booking: { status: 'cancelled', refundAmount: input.amount }, row: { id: input.id }, changed: 'cancelled', config: {} }; },
        reconcile: async id => { reconciled = id; return { booking: { status: 'confirmed' }, row: { id }, changed: 'confirmed', config: {} }; },
      },
      guard: async (_request, needAdmin) => { assert.equal(needAdmin, true); }, body: r => r.json(),
      failure: e => Response.json({ error: e.message }, { status: e.status || 500 }), notifyGuest: async (_row, kind) => { sent.push(kind); },
      notifyPayment: async (result, guest = true) => { payment.push([result.changed, guest]); }, paymentReady: () => false,
    },
    '@/lib/sms': { smsConfigured: () => true },
  });
  const post = body => new Request('https://shop.blendpunch.com/api/admin/jshouse', { method: 'POST', body: JSON.stringify(body) });
  const view = await (await admin.GET()).json();
  assert.equal(view.smsConfigured, true); assert.equal(view.paymentReady, false);
  assert.match(view.refundTemplate, /환불/, 'a starting point the operator can load and edit');
  await admin.POST(post({ action: 'decide', id: 'x', decision: 'confirm' })); assert.deepEqual(sent, ['confirmed']);
  await admin.POST(post({ action: 'decide', id: 'x', decision: 'decline', notify: false })); assert.deepEqual(sent, ['confirmed']);
  changed = false; await admin.POST(post({ action: 'decide', id: 'x', decision: 'confirm' })); assert.deepEqual(sent, ['confirmed']);
  // 환불 취소 — 금액·사유만 넘기고, 문자 알림 선택을 따른다
  const refunded = await (await admin.POST(post({ action: 'refund', id: 'paid-1', amount: 180000, reason: '고객 요청', status: 'cancelled' }))).json();
  assert.deepEqual(refundInput, { id: 'paid-1', amount: 180000, reason: '고객 요청' }); assert.equal(refunded.refundAmount, 180000);
  await admin.POST(post({ action: 'refund', id: 'paid-1', amount: 0, reason: '환불 없음', notify: false }));
  assert.deepEqual(payment, [['cancelled', true], ['cancelled', false]]);
  await admin.POST(post({ action: 'reconcile', id: 'stuck-1' })); assert.equal(reconciled, 'stuck-1'); assert.deepEqual(payment.at(-1), ['confirmed', true]);
  for (const action of ['config', 'days', 'create']) assert.equal((await admin.POST(post({ action }))).status, 200);
  assert.equal((await admin.POST(post({ action: 'drop' }))).status, 400);
});

test('published page shows every photo and only operator-confirmed facts', () => {
  const { SPACES, GLANCE, AMENITIES } = load('components/jshouse/content.ts');
  const s = sections();
  const Tour = load('components/jshouse/Tour.tsx').default;
  const config = { ...publicDefaults };
  const html = [render(s.Header), render(s.Hero), render(s.Glance), render(Tour), render(s.Amenities), render(s.Location, { config }), render(s.Guide, { config }), render(s.Closing)].join('');
  assert.equal(SPACES.length, 5);
  for (const space of SPACES) { assert.ok(html.includes(space.photo.src), space.key); assert.ok(html.includes(space.title)); }
  for (const item of GLANCE) assert.ok(html.includes(item.note));
  for (const group of AMENITIES) for (const item of group.items) assert.ok(html.includes(item), item);
  // 미정인 값은 지어내지 않고 '확정 후 안내'로 둔다
  assert.match(html, /상세 주소는 예약 확정 후 안내/); assert.match(html, /예약 확정 문자에서 함께 알려드려요/);
  assert.doesNotMatch(html, /\d{1,3}(,\d{3})+원|체크인 <b>|주차/);
  assert.match(html, /신청 단계에서는 결제하지 않습니다/);
  assert.match(html, /href="#reserve"/); assert.match(html, /href="#lookup"/); assert.match(html, /map\.naver\.com/); assert.match(html, /map\.kakao\.com/);
  assert.doesNotMatch(html, /DRAFT|TODO|lorem|undefined|NaN/i);
});

test('operator settings flow straight into the page', () => {
  const s = sections();
  const config = { ...publicDefaults, address: '서울 마포구 연남동 테스트로 1', walkNote: '홍대입구역 3번 출구에서 걸어서 8분', parkingNote: '주차 불가', mapUrl: 'https://naver.me/test', checkInTime: '15:00', checkOutTime: '11:00', maxGuests: 6, rules: '실내 금연\n\n밤 10시 이후 정숙' };
  const html = render(s.Location, { config }) + render(s.Guide, { config });
  for (const text of ['테스트로 1', '걸어서 8분', '주차 불가', 'https://naver.me/test', '15:00', '11:00', '최대 <b>6명</b>', '실내 금연', '밤 10시 이후 정숙']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /상세 주소는 예약 확정 후 안내/);
});

test('with card payment on, the page explains paying and shows the refund terms before purchase', () => {
  const s = sections();
  const terms = '이용일 7일 전까지 전액 환불\n이후 환불 불가';
  const off = render(s.Guide, { config: { ...publicDefaults, refundTerms: terms } });
  assert.match(off, /신청 단계에서는 결제하지 않습니다/); assert.doesNotMatch(off, /토스페이먼츠|이후 환불 불가/);
  const on = render(s.Guide, { config: { ...publicDefaults, refundTerms: terms }, pay: true });
  assert.match(on, /카드로 결제하면 바로 예약이 확정돼요/); assert.match(on, /토스페이먼츠/); assert.match(on, /취소·환불 규정이 궁금해요/);
  assert.match(on, /이용일 7일 전까지 전액 환불\n이후 환불 불가/); assert.match(on, /동의하신 취소·환불 규정에 따라/);
  assert.doesNotMatch(on, /신청 단계에서는 결제하지 않습니다/);
});

test('booking UI switches between request and card payment; the result page starts by confirming', () => {
  const mocks = {
    'next/link': link, 'next/navigation': { useRouter: () => ({ push() { throw Error('no navigation during render'); } }) }, '@tosspayments/tosspayments-sdk': { loadTossPayments: async () => { throw Error('must not load during render'); } },
    '@/lib/analytics': { fbqTrack() {}, commerceParams: () => ({}), trackPurchase() {} }, '@/lib/use-meta-event': { useMetaEvent() {} },
  };
  const Booking = load('components/jshouse/Booking.tsx', mocks);
  const view = props => renderToStaticMarkup(React.createElement(Booking.StayProvider, { initialConfig: publicDefaults, ...props },
    React.createElement(Booking.BookingSection), React.createElement(Booking.MobileBar)));
  const request = view({});
  assert.match(request, /예약 신청/); assert.match(request, /신청 단계에서는 결제하지 않아요/); assert.doesNotMatch(request, /카드 결제|토스페이먼츠/);
  const pay = view({ initialPay: true, clientKey: 'live_ck_test' });
  assert.match(pay, /카드 결제/); assert.match(pay, /토스페이먼츠 결제창/); assert.match(pay, /카드로 결제하면 바로 예약이 확정돼요/); assert.match(pay, /카드 결제 후 바로 예약 확정/);
  assert.doesNotMatch(pay, /신청 단계에서는 결제하지 않아요/);
  // 결제 키가 화면에 없으면 결제 안내를 하지 않는다 (결제창을 열 수 없으므로)
  assert.doesNotMatch(view({ initialPay: true, clientKey: '' }), /토스페이먼츠/);
  for (const html of [request, pay]) { assert.match(html, /id="lookup"/); assert.doesNotMatch(html, /undefined|NaN/); }
  const Result = load('components/jshouse/Result.tsx', mocks).default;
  const result = render(Result);
  assert.match(result, /결제를 확인하고 있어요/); assert.match(result, /href="\/hotel\/jshouse"/); assert.match(result, /카카오 상담/);
  assert.doesNotMatch(result, /예약이 확정됐어요/, 'never claims success before the server confirms');
  const { STATUS } = load('components/jshouse/stay.ts');
  for (const status of ['requested', 'pending', 'confirming', 'confirmed', 'cancelling', 'cancelled', 'declined', 'expired']) assert.ok(STATUS[status], status);
});

test('admin price fields accept ordinary prices such as 180,000', () => {
  // min=1 과 step=1000 을 함께 쓰면 브라우저가 1, 1001, 2001… 만 올바른 값으로 보아 설정 저장이 막힌다
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/jshouse/Admin.tsx'), 'utf8');
  const prices = source.match(/<input[^>]*type="number"[^>]*(?:Price|dayPrice)[^>]*>/g) || [];
  assert.equal(prices.length, 3);
  for (const field of prices) assert.doesNotMatch(field, /step=/, field);
});

test('JS House is linked from the home stay rail, hotel list, admin menu, sitemap rules and hides floating tools', () => {
  const css = new Proxy({}, { get: (_t, key) => String(key) });
  const Home = load('components/blend/BlendHome.tsx', { 'next/link': link, '@/components/FallbackImg': ({ src, alt, ...props }) => React.createElement('img', { ...props, src, alt }), './BlendHome.module.css': css }).default;
  const home = render(Home, { products: [], upcoming: [], categories: [], topSellerIds: [], catalogUnavailable: false });
  const rail = home.slice(home.indexOf('id="stay-picks"'));
  assert.match(rail, /이런 하루도, 공구로/);
  assert.ok(rail.indexOf('href="/hotel/jshouse"') > 0 && rail.indexOf('href="/hotel/jshouse"') < rail.indexOf('href="/hotel/dangung"'), 'JS House card comes first in the stay rail');
  assert.match(rail, /서울 연남동 · JS하우스/); assert.match(rail, /\/hotel\/jshouse\/bedroom\.webp/);
  assert.match(home, /href="\/hotel\/jshouse#lookup"/);
  const { STAY_BANNERS } = load('lib/stay-banners.ts');
  assert.equal(STAY_BANNERS[0].key, 'jshouse'); assert.equal(STAY_BANNERS[0].slides[0].href, '/hotel/jshouse');
  const nav = load('lib/admin-navigation.ts');
  assert.ok(nav.adminGroups('blendpick').some(g => g.items.some(i => i.href === '/admin/jshouse')));
  assert.equal(nav.adminGroups('sanjipick').some(g => g.items.some(i => i.href === '/admin/jshouse')), false);
  const { isFloatingExcludedPath } = load('lib/floating-visibility.ts');
  assert.equal(isFloatingExcludedPath('/hotel/jshouse'), true); assert.equal(isFloatingExcludedPath('/hotel/jshouse/result'), true); assert.equal(isFloatingExcludedPath('/hotel'), false);
  const { pageGroup } = load('lib/visit-analytics/rules.ts');
  assert.equal(pageGroup('/hotel/jshouse'), 'hotel');
});
