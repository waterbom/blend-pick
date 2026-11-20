// LIMEN 페이지·API·문자 문구 검증 — DB·네트워크 없이 모듈을 직접 불러 확인한다.
const { test } = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');
const core = require('../lib/limen-core.cjs');
const policy = require('../lib/limen-policy.cjs');
const { guestMessage, operatorMessage } = require('../lib/limen-messages.cjs');

const link = ({ children, href, prefetch, ...props }) => React.createElement('a', { ...props, href }, children);
const publicDefaults = core.publicConfig({ ...core.DEFAULT_CONFIG });
const sections = () => load('components/limen/Sections.tsx', { 'next/link': link, '@/components/limen/Booking': { QuickBar: () => React.createElement('button', null, '날짜 보기'), RoomCta: ({ room }) => React.createElement('button', { 'data-room': room }, '날짜 보기') } });
const ROOMS = { one: { ...core.DEFAULT_ROOMS.one }, two: { ...core.DEFAULT_ROOMS.two } };
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props));

test('rates follow the sheet the stay sent: weekday, Friday, Saturday, then seasons and one-off prices', () => {
  const { one, two } = core.DEFAULT_ROOMS;
  // 2026-11-19 목 · 11-20 금 · 11-21 토 · 11-22 일
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map(d => core.rateOf(d)), ['weekday', 'friday', 'saturday', 'weekday']);
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map(d => core.priceOf(d, one)), [200000, 230000, 250000, 200000]);
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map(d => core.priceOf(d, two)), [350000, 380000, 400000, 350000]);
  // 시즌으로 지정한 날은 요일과 상관없이 그 요금, 날짜에 따로 넣은 요금이 가장 먼저
  assert.equal(core.priceOf('2026-11-21', one, { season: 'shoulder' }), 270000); assert.equal(core.priceOf('2026-11-19', two, { season: 'peak' }), 450000);
  assert.equal(core.priceOf('2026-11-21', two, { season: 'peak', price: 390000 }), 390000);
  assert.equal(core.priceOf('2026-11-20', { ...one, friday: null }), null);
  // 연박은 1박 요금의 합 — 숙소 안내의 5박·7박 범위와 같다 (원룸 100–150만 / 140–210만, 투룸 175–225만 / 245–315만)
  for (const [room, nights, low, high] of [[one, 5, 1000000, 1500000], [one, 7, 1400000, 2100000], [two, 5, 1750000, 2250000], [two, 7, 2450000, 3150000]]) {
    assert.equal(room.weekday * nights, low); assert.equal(room.peak * nights, high);
  }
  const stay = core.estimate(two, { '2026-11-21': { season: 'peak' } }, core.nightsOf('2026-11-19', '2026-11-22'));
  assert.deepEqual(stay.nightly.map(n => [n.price, n.rate]), [[350000, 'weekday'], [380000, 'friday'], [450000, 'peak']]); assert.equal(stay.total, 1180000);
  // 요금이 비어 있는 밤이 있으면 합계를 지어내지 않는다
  assert.equal(core.estimate({ ...one, saturday: null }, {}, core.nightsOf('2026-11-20', '2026-11-22')).total, null);
  assert.deepEqual(core.nightsOf('2026-12-31', '2027-01-02'), ['2026-12-31', '2027-01-01']);
  assert.throws(() => core.nightsOf('2026-11-20', '2026-11-20'), /숙박 기간/);
  // 새 예약번호는 LM-, 브랜드명 확정 전의 JS- 번호도 받는다
  assert.equal(core.cleanCode(' lm-ab2cd3 '), 'LM-AB2CD3'); assert.equal(core.cleanCode('lmab2cd3'), 'LM-AB2CD3'); assert.equal(core.cleanCode('jsab2cd3'), 'JS-AB2CD3');
  assert.equal(core.today(new Date('2026-11-16T15:00:00Z')), '2026-11-17');
});

test('season calendar: summer and year-end seasons, feast holidays and holiday eves follow the published periods', () => {
  const kind = day => policy.autoSeason(day);
  // 여름: 7/15–7/19 준성수기 · 7/20–8/15 극성수기 · 8/16–8/24 준성수기 (해마다 같다)
  for (const year of ['2027', '2028']) {
    assert.deepEqual(['07-14', '07-15', '07-19', '07-20', '08-15', '08-16', '08-24', '08-25'].map(d => kind(`${year}-${d}`)), ['', 'shoulder', 'shoulder', 'peak', 'peak', 'shoulder', 'shoulder', '']);
  }
  // 연말: 12/20–12/30 준성수기, 12/24 · 12/25 · 12/31 극성수기. 1/1 밤부터는 평시
  assert.deepEqual(['12-19', '12-20', '12-23', '12-24', '12-25', '12-26', '12-30', '12-31'].map(d => kind(`2026-${d}`)), ['', 'shoulder', 'shoulder', 'peak', 'peak', 'shoulder', 'shoulder', 'peak']);
  assert.equal(kind('2027-01-01'), ''); assert.equal(kind('2027-01-02'), '');
  // 설(2027-02-06–09) · 추석(2027-09-14–16): 연휴 전날 밤부터 마지막 날 전날 밤까지 준성수기
  assert.deepEqual(['2027-02-04', '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'].map(kind), ['', 'shoulder', 'shoulder', 'shoulder', 'shoulder', '']);
  assert.deepEqual(['2027-09-12', '2027-09-13', '2027-09-14', '2027-09-15', '2027-09-16'].map(kind), ['', 'shoulder', 'shoulder', 'shoulder', '']);
  assert.deepEqual(['2028-01-25', '2028-01-27', '2028-01-28', '2028-10-01', '2028-10-04', '2028-10-05'].map(kind), ['shoulder', 'shoulder', '', 'shoulder', 'shoulder', '']);
  // 평일에 드는 공휴일의 전날 밤은 토요일 요금 ('holiday'). 주말에 드는 공휴일은 요일 요금 그대로.
  assert.deepEqual(['2027-02-28', '2027-05-02', '2027-05-04', '2027-05-12', '2027-10-03', '2027-10-10'].map(kind), Array(6).fill('holiday'));
  assert.equal(kind('2027-12-26'), 'shoulder', 'a season outranks a holiday eve');
  assert.deepEqual(['2027-04-30', '2027-06-05', '2027-07-16', '2027-10-02', '2027-10-08'].map(kind), ['', '', 'shoulder', '', ''], 'holidays on a weekend add nothing');
  const one = core.DEFAULT_ROOMS.one;
  assert.deepEqual(['2027-02-28', '2027-05-04'].map(d => [core.rateOf(d), core.priceOf(d, one)]), [['saturday', 250000], ['saturday', 250000]]);
  // 요금 순서: 날짜에 넣은 요금 → 운영자가 지정한 시즌(평시 고정 포함) → 시즌 달력 → 요일
  assert.equal(core.priceOf('2026-12-24', one), 300000); assert.equal(core.priceOf('2026-12-24', one, { season: 'normal' }), 200000);
  assert.equal(core.priceOf('2026-12-24', one, { season: 'shoulder' }), 270000); assert.equal(core.priceOf('2026-12-24', one, { price: 99000, season: 'peak' }), 99000);
  assert.equal(core.priceOf('2026-12-24', one, {}, false), 200000, 'calendar switched off'); assert.equal(core.priceOf('2026-12-24', one, { season: 'peak' }, false), 300000);
  assert.deepEqual(core.nightOf('2026-12-24', one), { day: '2026-12-24', price: 300000, rate: 'peak', season: 'peak', weekend: true, manual: false });
  // 환불 기준의 주말: 금·토요일 숙박과 공휴일 전날 숙박
  assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-12-24', '2027-04-30', '2027-05-04'].map(policy.isWeekendNight), [false, true, true, false, true, true, true]);
  // 공휴일 표: 날짜 형식이 맞고 겹치지 않으며 마지막 날까지 들어 있다. 안내문은 달력과 같은 기간을 말한다.
  const days = [...policy.HOLIDAYS.keys()];
  assert.ok(days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && core.date(d))); assert.deepEqual(days, [...days].sort()); assert.equal(days.at(-1) <= policy.HOLIDAYS_UNTIL, true); assert.equal(days.at(-1), '2028-12-25');
  assert.deepEqual(policy.SEASON_GUIDE.map(g => [g.key, g.text]), [['peak', '7월 20일–8월 15일 · 12월 24·25·31일'], ['shoulder', '7월 15–19일 · 8월 16–24일 · 12월 20–30일 · 설·추석 연휴'], ['holiday', '토요일 요금 (평일에 드는 공휴일의 전날 밤)']]);
});

test('standard refund terms follow the Fair Trade Commission lodging table, and the quote matches the published text', () => {
  const terms = core.STANDARD_REFUND_TERMS;
  assert.equal(core.DEFAULT_CONFIG.refundTerms, terms); assert.equal(core.mergeConfig({ refundTerms: '' }).refundTerms, terms); assert.equal(core.mergeConfig({ refundTerms: ' \n ' }).refundTerms, terms);
  assert.equal(core.mergeConfig({ refundTerms: '직접 쓴 규정입니다. 입실 7일 전까지 전액 환불.' }).refundTerms, '직접 쓴 규정입니다. 입실 7일 전까지 전액 환불.');
  assert.equal(core.validateConfig({ ...core.DEFAULT_CONFIG, refundTerms: '' }).refundTerms, terms); assert.ok(terms.length < 4000);
  for (const line of ['공정거래위원회 「소비자분쟁해결기준(숙박업)」을 따릅니다.', '· 결제 후 24시간 이내 취소 (입실일 0시 전까지)', '· 성수기: 입실 10일 전까지 취소', '· 비수기: 입실 2일 전까지 취소',
    '· 입실 9~7일 전: 주중 90% · 주말 80% 환불', '· 입실 6~5일 전: 주중 70% · 주말 60% 환불', '· 입실 4~3일 전: 주중 50% · 주말 40% 환불', '· 입실 2일 전~당일, 미입실: 주중 20% · 주말 10% 환불',
    '· 입실 1일 전: 주중 90% · 주말 80% 환불', '· 입실 당일, 미입실: 주중 80% · 주말 70% 환불', '주말은 금·토요일과 공휴일 전날 입실입니다.', '천재지변으로 머물 수 없게 된 경우에는 전액 환불합니다.']) assert.ok(terms.includes(line), line);
  // 공제율: 성수기 주중 0·10·30·50·80 / 주말 0·20·40·60·90, 비수기 주중 0·10·20 / 주말 0·20·30
  const at = day => new Date(`${day}T03:00:00Z`), checkIn = '2027-08-10', paidAt = '2027-06-01T00:00:00Z';
  const percent = (high, weekend, day) => policy.refundQuote({ amount: 1000000, checkIn, high, weekend, paidAt }, at(day)).percent;
  const days = ['2027-07-31', '2027-08-01', '2027-08-03', '2027-08-04', '2027-08-05', '2027-08-06', '2027-08-07', '2027-08-08', '2027-08-09', '2027-08-10', '2027-08-11']; // 입실 10 · 9 · 7 · 6 · 5 · 4 · 3 · 2 · 1 · 0일 전, 입실 다음 날
  assert.deepEqual(days.map(d => percent(true, false, d)), [0, 10, 10, 30, 30, 50, 50, 80, 80, 80, 80]);
  assert.deepEqual(days.map(d => percent(true, true, d)), [0, 20, 20, 40, 40, 60, 60, 90, 90, 90, 90]);
  assert.deepEqual(days.map(d => percent(false, false, d)), [0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 20]);
  assert.deepEqual(days.map(d => percent(false, true, d)), [0, 0, 0, 0, 0, 0, 0, 0, 20, 30, 30]);
  assert.deepEqual(policy.refundQuote({ amount: 450000, checkIn, high: true, weekend: true, paidAt }, at('2027-08-05')), { daysBefore: 5, percent: 40, fee: 180000, refund: 270000, free: false, basis: '성수기 주말 · 입실 5일 전 취소' });
  assert.equal(policy.refundQuote({ amount: 450000, checkIn, high: false, weekend: false, paidAt }, at('2027-08-12')).basis, '비수기 주중 · 입실일 이후 취소');
  // 결제 후 24시간 이내는 전액 — 단, 입실일 0시(한국 시간)가 지나면 표의 기준을 따른다
  const soon = { amount: 300000, checkIn: '2027-08-10', high: true, weekend: false };
  assert.equal(policy.refundQuote({ ...soon, paidAt: '2027-08-08T10:00:00Z' }, new Date('2027-08-09T09:59:00Z')).refund, 300000);
  assert.equal(policy.refundQuote({ ...soon, paidAt: '2027-08-08T10:00:00Z' }, new Date('2027-08-09T10:01:00Z')).refund, 60000, 'past 24 hours');
  assert.equal(policy.refundQuote({ ...soon, paidAt: '2027-08-09T10:00:00Z' }, new Date('2027-08-09T15:00:00Z')).refund, 60000, 'already the check-in day in Korea');
  // 표준 규정에 동의한 결제 예약만 계산한다 — 입실일의 성수기·주말 구분은 결제할 때 남긴 값
  const row = { paid_at: paidAt, amount: 450000, check_in: checkIn, estimate: { refundTerms: terms, nightly: [{ day: checkIn, season: 'peak', weekend: false }] } };
  assert.equal(core.refundFor(row, at('2027-08-05')).refund, 315000);
  assert.equal(core.refundFor({ ...row, estimate: { ...row.estimate, refundTerms: '다른 규정' } }, at('2027-08-05')), null);
  assert.equal(core.refundFor({ ...row, paid_at: null }, at('2027-08-05')), null);
});

test('settings merge per room, ignore unknown keys and never publish the operator phone', () => {
  const merged = core.mergeConfig({ rooms: { one: { weekday: 150000, hacked: 1 }, suite: { weekday: 1 } }, hacked: true, notifyPhone: '01011112222', weekdayPrice: 99 });
  assert.equal(merged.rooms.one.weekday, 150000); assert.equal(merged.rooms.one.friday, 230000); assert.deepEqual(merged.rooms.two, ROOMS.two);
  assert.deepEqual(Object.keys(merged.rooms), ['one', 'two']); assert.equal('hacked' in merged.rooms.one, false);
  assert.equal('hacked' in merged, false); assert.equal('weekdayPrice' in merged, false);
  assert.equal('notifyPhone' in core.publicConfig(merged), false); assert.equal(core.publicConfig(merged).rooms.two.peak, 450000);
  assert.equal(core.validateConfig({ ...core.DEFAULT_CONFIG, notifyPhone: '010-1111-2222' }).notifyPhone, '01011112222');
  assert.throws(() => core.validateConfig({ ...core.DEFAULT_CONFIG, notifyPhone: '1234' }), /휴대폰/);
  assert.throws(() => core.validateConfig({ ...core.DEFAULT_CONFIG, windowDays: 5 }), /달력 공개 기간/);
  assert.throws(() => core.validateConfig({ ...core.DEFAULT_CONFIG, rooms: { ...ROOMS, two: { ...ROOMS.two, saturday: 0 } } }), /투룸 토요일 요금/);
  // 기본값을 고쳐 쓸 수 없다 (요청마다 같은 요금표에서 시작)
  assert.ok(Object.isFrozen(core.DEFAULT_ROOMS) && Object.isFrozen(core.DEFAULT_ROOMS.one) && Object.isFrozen(core.DEFAULT_ROOMS.two));
  assert.notEqual(core.mergeConfig({}).rooms.one, core.DEFAULT_ROOMS.one, 'each request works on its own copy');
});

test('messages state facts only: no price, address or time unless the operator set them', () => {
  const row = { code: 'LM-AB2CD3', room: 'two', guest_name: '김연남', guest_phone: '01012345678', check_in: '2026-11-19', check_out: '2026-11-22', guests: 3, memo: '저녁 도착', estimate: { total: null } };
  const requested = guestMessage(row, 'requested');
  assert.match(requested, /^\[LIMEN · 블랜드픽\] 예약 신청 접수/); assert.match(requested, /LM-AB2CD3/); assert.match(requested, /객실: 투룸/);
  assert.match(guestMessage({ ...row, room: 'one' }, 'requested'), /객실: 원룸/); assert.doesNotMatch(guestMessage({ ...row, room: undefined }, 'requested'), /객실:/); assert.match(requested, /2026-11-19 ~ 2026-11-22 \(3박\)/);
  assert.match(requested, /아직 예약이 확정된 것은 아닙니다/); assert.doesNotMatch(requested, /원\b|주소|입실 \d/);
  const confirmed = guestMessage({ ...row, estimate: { total: 640000 } }, 'confirmed', { checkInTime: '15:00', checkOutTime: '', address: '서울 마포구 연남동 테스트로 1' });
  assert.match(confirmed, /예약이 확정되었습니다/); assert.match(confirmed, /640,000원/); assert.match(confirmed, /입실 15:00 · 퇴실 별도 안내/); assert.match(confirmed, /테스트로 1/);
  assert.match(guestMessage(row, 'declined'), /예약이 어렵습니다/);
  assert.match(guestMessage(row, 'cancelled'), /예약이 취소되었습니다/);
  for (const kind of ['requested', 'confirmed', 'declined', 'cancelled']) { assert.match(guestMessage(row, kind), /hotel\/limen#lookup/); assert.doesNotMatch(guestMessage(row, kind), /JS하우스|jshouse/i); }
  const operator = operatorMessage(row, 'requested');
  assert.match(operator, /새 예약 신청/); assert.match(operator, /01012345678/); assert.match(operator, /요청: 저녁 도착/); assert.match(operator, /admin\/limen/);
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
  const server = load('lib/limen-server.ts', {
    '@/lib/db-shop': {}, '@/lib/sms': { sendSMS: async () => ({ ok: true }), smsConfigured: () => false },
    'next/headers': { headers: async () => new Headers({ host }), cookies: async () => ({ get: () => (token ? { value: token } : undefined), set() {} }) },
    '@/lib/auth': { verifyAdminToken: async t => (t === 'valid' ? { id: '1' } : null) },
  }, modules);
  const post = origin => new Request('https://shop.blendpunch.com/api/limen', { method: 'POST', headers: origin ? { origin } : {} });
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
  const route = load('app/api/limen/route.ts', {
    '@/lib/api-errors': { withApiErrors: (_name, handler) => handler },
    '@/lib/limen-server': {
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
  const url = 'https://shop.blendpunch.com/api/limen';
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
  const admin = load('app/api/admin/limen/route.ts', {
    '@/lib/api-errors': { withApiErrors: (_name, handler) => handler },
    '@/lib/limen-server': {
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
  const post = body => new Request('https://shop.blendpunch.com/api/admin/limen', { method: 'POST', body: JSON.stringify(body) });
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

const page = (s, config, pay = false) => {
  // 공간 둘러보기는 예약 상태(객실별 인원)와 '날짜 보기' 버튼을 함께 쓴다
  const Tour = load('components/limen/Tour.tsx', { '@/components/limen/Booking': { useStay: () => ({ config }), RoomCta: ({ room }) => React.createElement('button', { 'data-tour-room': room }, '날짜 보기') } }).default;
  return [render(s.Intro), render(s.Header), render(s.Hero), render(s.Definition), render(s.Passage), render(s.Story), render(s.Values), render(s.Rooms, { config }), render(Tour),
    render(s.Amenities), render(s.Location, { config }), render(s.Guide, { config, pay }), render(s.Closing)].join('');
};

test('published page carries the LIMEN brand copy, every photo, and the rate sheet as sent', () => {
  const content = load('components/limen/content.ts');
  const html = page(sections(), { ...publicDefaults });
  // 브랜드 문서의 문장 그대로 (정의·이름의 뜻·시작한 이유·가치·스토리)
  assert.match(html, /경계를 넘어,/); assert.match(html, /고요함 속으로\./); assert.match(html, /Beyond the Threshold, Into Stillness\./);
  assert.ok(html.includes(`aria-label="${content.BRAND.definition}"`)); assert.equal(content.BRAND.definition, 'LIMEN은 도시의 활기와 개인의 고요함 사이에 존재하는 하나의 경계입니다.');
  assert.match(html, /LIMEN은 라틴어로 ‘문턱’을 의미합니다\./); assert.match(html, /LIMEN은 여섯 명의 가족의 마음이 모여 시작된 새로운 출발입니다\./);
  for (const text of [...content.STORY.body, content.STORY.quote, ...content.PASSAGE, ...content.CLOSING.lines, content.CLOSING.vision]) assert.ok(html.includes(text), text);
  assert.deepEqual(content.VALUES.map(v => v.en), ['Threshold', 'Privacy', 'Stillness', 'Sincerity']);
  for (const value of content.VALUES) { assert.ok(html.includes(value.en)); assert.ok(html.includes(value.ko)); for (const line of value.body) assert.ok(html.includes(line), line); }
  // 사진: 객실별 공간 (원룸 4 · 투룸 5). 둘러보기는 원룸부터 열리고, 투룸 사진은 첫 화면·스토리·객실 카드 등에도 쓰인다.
  assert.deepEqual(Object.fromEntries(Object.entries(content.SPACES_BY_ROOM).map(([room, list]) => [room, list.length])), { one: 4, two: 5 });
  assert.equal(content.SPACES.length, 9); assert.equal(new Set(content.SPACES.map(space => space.key)).size, 9);
  const exists = file => require('node:fs').existsSync(require('node:path').join(__dirname, '../public', file));
  for (const space of content.SPACES) { assert.ok(html.includes(space.photo.src), space.key); assert.ok(exists(space.photo.src), space.photo.src); assert.ok(exists(space.photo.small), space.photo.small); }
  for (const space of content.SPACES_BY_ROOM.one) { assert.ok(html.includes(space.title), space.title); assert.ok(html.includes(space.body), space.key); }
  assert.match(html, /role="tab" aria-selected="true"[^>]*>원룸<small>2인 · 사진 4장/); assert.match(html, /role="tab" aria-selected="false"[^>]*>투룸<small>4인 · 사진 5장/);
  assert.match(html, /data-tour-room="one"/);
  // 객실 카드마다 대표 사진
  for (const room of ['one', 'two']) { assert.ok(html.includes(`alt="${content.ROOMS[room].alt}"`), room); assert.ok(exists(content.ROOMS[room].photo.src)); }
  for (const room of ['one', 'two']) for (const group of content.AMENITIES[room]) for (const item of group.items) assert.ok(html.includes(item), item);
  assert.doesNotMatch(html, /준비되는 대로/, 'both rooms now have photos');
  // 객실 요금 안내: 1박 요금 10칸, 연박 범위, 이용 인원
  for (const price of ['200,000원', '230,000원', '250,000원', '270,000원', '300,000원', '350,000원', '380,000원', '400,000원', '420,000원', '450,000원']) assert.ok(html.includes(`<td>${price}</td>`), price);
  for (const range of ['1,000,000–1,500,000원', '1,400,000–2,100,000원', '1,750,000–2,250,000원', '2,450,000–3,150,000원']) assert.ok(html.includes(range), range);
  assert.match(html, /원룸 · 2인/); assert.match(html, /투룸 · 4인/); assert.match(html, /2인 \/ 2인/); assert.match(html, /4인 \/ 4인/); assert.match(html, /<dt>인원 추가<\/dt><dd>불가<\/dd>/);
  assert.match(html, /모든 요금은 객실당 기준이며, 기준 인원을 초과한 입실은 불가합니다\./);
  assert.match(html, /<b>200,000원<\/b>부터/); assert.match(html, /<b>350,000원<\/b>부터/);
  assert.equal((html.match(/data-room="(one|two)"/g) || []).join(), 'data-room="one",data-room="two"');
  // 숙소 내부용 메모·미정 사항은 싣지 않는다. 미정인 주소·시간은 지어내지 않는다.
  assert.doesNotMatch(html, /제안안|공동구매|블럭표|플레이스|인스타그램|수수료/);
  assert.match(html, /상세 주소는 예약 확정 후 안내/); assert.match(html, /예약 확정 문자에서 함께 알려드립니다/);
  assert.doesNotMatch(html, /체크인 <b>|주차/);
  assert.match(html, /신청 단계에서는 결제하지 않습니다/);
  assert.match(html, /href="#reserve"/); assert.match(html, /href="#lookup"/); assert.match(html, /map\.naver\.com/); assert.match(html, /map\.kakao\.com/);
  // 예전 이름과 예전 서체가 남아 있지 않다
  assert.doesNotMatch(html, /JS하우스|JS HOUSE|jshouse|jsh-/i); assert.doesNotMatch(html, /DRAFT|TODO|lorem|undefined|NaN/i);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../app/hotel/limen/page.tsx'), 'utf8'), /import "@\/components\/limen\/fonts\/pretendard\.css";/);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/limen/limen.css'), 'utf8');
  assert.match(css, /--sans:"Pretendard Variable"/); assert.doesNotMatch(css, /Serif|Mono|\.jsh/);
  const fonts = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/limen/fonts/pretendard.css'), 'utf8');
  const files = [...fonts.matchAll(/url\(\.\/(woff2-dynamic-subset\/[^)]+)\)/g)].map(m => m[1]);
  assert.equal(files.length, 92); for (const file of files) assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '../components/limen/fonts', file)), file);
});

test('operator settings and rate edits flow straight into the page', () => {
  const s = sections();
  const rooms = { one: { ...ROOMS.one, weekday: 190000, peak: null }, two: { ...ROOMS.two, guests: 5 } };
  const config = { ...publicDefaults, rooms, address: '서울 마포구 연남동 테스트로 1', walkNote: '홍대입구역 3번 출구에서 걸어서 8분', parkingNote: '주차 불가', mapUrl: 'https://naver.me/test', checkInTime: '15:00', checkOutTime: '11:00', rules: '실내 금연\n\n밤 10시 이후 정숙' };
  const html = render(s.Rooms, { config }) + render(s.Location, { config }) + render(s.Guide, { config });
  for (const text of ['<td>190,000원</td>', '<b>190,000원</b>부터', '투룸 · 5인', '5인 / 5인', '투룸은 <b>5인</b>', '테스트로 1', '걸어서 8분', '주차 불가', 'https://naver.me/test', '15:00', '11:00', '실내 금연', '밤 10시 이후 정숙']) assert.ok(html.includes(text), text);
  // 시즌 기간 안내: 자동 적용이 켜져 있으면 시즌 달력의 기간을, 꺼져 있으면 '날짜로 지정'만 알린다
  for (const text of ['<b>극성수기</b> 7월 20일–8월 15일 · 12월 24·25·31일', '<b>준성수기</b> 7월 15–19일 · 8월 16–24일 · 12월 20–30일 · 설·추석 연휴', '<b>공휴일 전날</b> 토요일 요금']) assert.ok(html.includes(text), text);
  const manual = render(s.Rooms, { config: { ...config, autoSeasons: false } });
  assert.doesNotMatch(manual, /7월 20일/); assert.match(manual, /준성수기·극성수기는 날짜로 지정되며/); assert.match(manual, /<small>달력에 표시<\/small>/);
  // 비워 둔 요금은 지어내지 않고 '문의'로 — 연박 범위도 내지 않는다
  assert.ok(html.includes('<td>문의</td>')); assert.doesNotMatch(html, /<td>300,000원<\/td>/); assert.match(html, /<small>원룸<\/small>문의/);
  assert.doesNotMatch(html, /상세 주소는 예약 확정 후 안내/);
});

test('with card payment on, the page explains paying and shows the refund terms before purchase', () => {
  const s = sections();
  const terms = '이용일 7일 전까지 전액 환불\n이후 환불 불가';
  const off = render(s.Guide, { config: { ...publicDefaults, refundTerms: terms } });
  assert.match(off, /신청 단계에서는 결제하지 않습니다/); assert.doesNotMatch(off, /토스페이먼츠|이후 환불 불가/);
  const on = render(s.Guide, { config: { ...publicDefaults, refundTerms: terms }, pay: true });
  assert.match(on, /카드로 결제하면 바로 예약이 확정됩니다/); assert.match(on, /토스페이먼츠/); assert.match(on, /취소·환불 규정이 궁금해요/);
  assert.match(on, /이용일 7일 전까지 전액 환불\n이후 환불 불가/); assert.match(on, /동의하신 취소·환불 규정에 따라/);
  assert.doesNotMatch(on, /신청 단계에서는 결제하지 않습니다/);
});

test('booking UI switches between request and card payment; the result page starts by confirming', () => {
  const mocks = {
    'next/link': link, 'next/navigation': { useRouter: () => ({ push() { throw Error('no navigation during render'); } }) }, '@tosspayments/tosspayments-sdk': { loadTossPayments: async () => { throw Error('must not load during render'); } },
    '@/lib/analytics': { fbqTrack() {}, commerceParams: () => ({}), trackPurchase() {} }, '@/lib/use-meta-event': { useMetaEvent() {} },
  };
  const Booking = load('components/limen/Booking.tsx', mocks);
  const view = props => renderToStaticMarkup(React.createElement(Booking.StayProvider, { initialConfig: publicDefaults, ...props },
    React.createElement(Booking.BookingSection), React.createElement(Booking.MobileBar)));
  const request = view({});
  // 객실 고르기: 두 객실과 요금표의 가장 낮은 1박 요금
  for (const text of ['ONE ROOM', 'TWO ROOM', '1박 200,000원부터', '1박 350,000원부터', '투룸 최대 4인 · 추가 불가', 'LM-XXXXXX']) assert.ok(request.includes(text), text);
  assert.match(request, /role="radio" aria-checked="true"[^>]*><span>TWO ROOM/);
  assert.match(request, /예약 신청/); assert.match(request, /신청 단계에서는 결제하지 않아요/); assert.doesNotMatch(request, /카드 결제|토스페이먼츠/);
  const pay = view({ initialPay: true, clientKey: 'live_ck_test' });
  assert.match(pay, /카드 결제/); assert.match(pay, /토스페이먼츠 결제창/); assert.match(pay, /카드로 결제하면 바로 예약이 확정돼요/); assert.match(pay, /카드 결제 후 바로 예약 확정/);
  assert.doesNotMatch(pay, /신청 단계에서는 결제하지 않아요/);
  // 결제 키가 화면에 없으면 결제 안내를 하지 않는다 (결제창을 열 수 없으므로)
  assert.doesNotMatch(view({ initialPay: true, clientKey: '' }), /토스페이먼츠/);
  for (const html of [request, pay]) { assert.match(html, /id="lookup"/); assert.doesNotMatch(html, /undefined|NaN/); }
  const Result = load('components/limen/Result.tsx', mocks).default;
  const result = render(Result);
  assert.match(result, /결제를 확인하고 있어요/); assert.match(result, /href="\/hotel\/limen"/); assert.match(result, /카카오 상담/);
  assert.doesNotMatch(result, /예약이 확정됐어요/, 'never claims success before the server confirms');
  const { STATUS } = load('components/limen/stay.ts');
  for (const status of ['requested', 'pending', 'confirming', 'confirmed', 'cancelling', 'cancelled', 'declined', 'expired']) assert.ok(STATUS[status], status);
});

test('admin: rate fields accept ordinary prices and every room, rate and season can be set', () => {
  // min=1 과 step=1000 을 함께 쓰면 브라우저가 1, 1001, 2001… 만 올바른 값으로 보아 설정 저장이 막힌다
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../components/limen/Admin.tsx'), 'utf8');
  assert.ok((source.match(/type="number"/g) || []).length >= 7, 'rate table, capacity, one-off price and period fields');
  assert.doesNotMatch(source, /step=/);
  for (const text of ['블럭표', '준성수기로 지정', '극성수기로 지정', '평시로 고정', '지정 풀기 (자동)', '성수기·공휴일 자동 적용', '표준 규정으로 되돌리기', '표준 규정 기준 환불 금액', '이 요금으로 지정', '지정 요금 지우기', '예약 닫기', '다시 열기', 'name="room"']) assert.ok(source.includes(text), text);
  // 블럭표의 요금·시즌과 환불 금액은 서버가 계산해 준 값을 쓴다 (화면에서 다시 계산하지 않는다)
  assert.match(source, /data\.chart\[room\.key\]/); assert.doesNotMatch(source, /function priceOf/);
  for (const rate of core.RATE_KEYS) assert.ok(source.includes(`key: "${rate}"`), rate);
  assert.doesNotMatch(source, /weekdayPrice|weekendPrice|maxGuests|JS하우스/);
});

test('LIMEN is linked from the home stay rail, hotel list, admin menu, sitemap rules and hides floating tools', async () => {
  const css = new Proxy({}, { get: (_t, key) => String(key) });
  const Home = load('components/blend/BlendHome.tsx', { 'next/link': link, '@/components/FallbackImg': ({ src, alt, ...props }) => React.createElement('img', { ...props, src, alt }), './BlendHome.module.css': css }).default;
  const home = render(Home, { products: [], upcoming: [], categories: [], topSellerIds: [], catalogUnavailable: false });
  const rail = home.slice(home.indexOf('id="stay-picks"'));
  assert.match(rail, /이런 하루도, 공구로/);
  assert.ok(rail.indexOf('href="/hotel/limen"') > 0 && rail.indexOf('href="/hotel/limen"') < rail.indexOf('href="/hotel/dangung"'), 'LIMEN card comes first in the stay rail');
  assert.match(rail, /서울 연남동 · LIMEN/); assert.match(rail, /\/hotel\/limen\/twin\.webp/); assert.match(rail, /경계를 넘어, 고요함 속으로/);
  assert.doesNotMatch(home, /JS하우스|jshouse/i);
  assert.match(home, /href="\/hotel\/limen#lookup"/);
  const { STAY_BANNERS } = load('lib/stay-banners.ts');
  assert.equal(STAY_BANNERS[0].key, 'limen'); assert.equal(STAY_BANNERS[0].slides[0].href, '/hotel/limen');
  const nav = load('lib/admin-navigation.ts');
  assert.ok(nav.adminGroups('blendpick').some(g => g.items.some(i => i.href === '/admin/limen')));
  assert.equal(nav.adminGroups('sanjipick').some(g => g.items.some(i => i.href === '/admin/limen')), false);
  const { isFloatingExcludedPath } = load('lib/floating-visibility.ts');
  assert.equal(isFloatingExcludedPath('/hotel/limen'), true); assert.equal(isFloatingExcludedPath('/hotel/limen/result'), true); assert.equal(isFloatingExcludedPath('/hotel'), false);
  const { pageGroup } = load('lib/visit-analytics/rules.ts');
  assert.equal(pageGroup('/hotel/limen'), 'hotel');
  // 브랜드명 확정 전 주소로 보낸 문자·공유 링크는 새 주소로 넘어간다
  const redirects = await load('next.config.ts').default.redirects();
  for (const [from, to] of [['/hotel/jshouse', '/hotel/limen'], ['/hotel/jshouse/:path*', '/hotel/limen/:path*'], ['/admin/jshouse', '/admin/limen']]) {
    assert.ok(redirects.some(r => r.source === from && r.destination === to && r.permanent), from);
  }
});
