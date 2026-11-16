// JS하우스 예약 원장 — 격리된 PGlite(PostgreSQL)에서 예약 신청과 카드 결제 전체 흐름을 검증한다. 운영 DB·문자 발송·실제 결제 없음.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const core = require('../lib/jshouse-core.cjs');

test('JS House booking request ledger (isolated PostgreSQL)', async t => {
  const db = new PGlite();
  let queue = Promise.resolve(), clock = new Date('2026-11-16T03:00:00Z'); // KST 2026-11-16 12:00
  const query = (sql, args) => db.query(sql, args);
  // 한 연결을 순서대로 쓰게 해서 트랜잭션이 섞이지 않게 한다
  const pool = { query, connect: async () => { const previous = queue; let release; queue = new Promise(r => { release = r; }); await previous; return { query, release }; } };
  const api = core.service(pool, { now: () => clock });
  const A = 'guest-browser-A', B = 'guest-browser-B';
  const input = (checkIn, checkOut, extra = {}) => ({ requestId: randomUUID(), checkIn, checkOut, guests: 2, guestName: '테스트손님', guestPhone: '010-1234-5678', memo: '', agreed: true, ...extra });
  const nights = async () => (await db.query('SELECT day::text FROM jshouse_nights ORDER BY day')).rows.map(r => r.day);

  try {
    await t.test('schema is repeatable and starts open with no prices', async () => {
      const { prepare } = require('../scripts/prepare-jshouse.cjs');
      const run = () => prepare({ query: sql => db.exec(sql) });
      await run(); await run();
      const c = await api.calendar();
      assert.equal(c.today, '2026-11-16'); assert.equal(c.lastDay, '2027-05-15');
      assert.equal(c.config.open, true); assert.equal(c.config.weekdayPrice, null);
      assert.equal('notifyPhone' in c.config, false, 'operator phone must stay private');
      assert.deepEqual(c.taken, []); assert.deepEqual(c.closed, []);
    });

    let first;
    await t.test('a request holds its nights at once and repeats safely', async () => {
      const req = input('2026-11-20', '2026-11-22');
      const one = await api.request(req, A), two = await api.request(req, A);
      first = one.booking;
      assert.equal(one.created, true); assert.equal(two.created, false); assert.equal(two.booking.code, first.code);
      assert.match(first.code, /^JS-[A-Z2-9]{6}$/); assert.equal(first.status, 'requested'); assert.equal(first.nights, 2);
      assert.equal(first.estimate.total, null, 'no price configured → no invented total');
      assert.deepEqual(await nights(), ['2026-11-20', '2026-11-21']);
      assert.deepEqual((await api.calendar()).taken, ['2026-11-20', '2026-11-21']);
    });

    await t.test('overlapping stays are refused; the checkout day can start another stay', async () => {
      await assert.rejects(api.request(input('2026-11-21', '2026-11-23'), B), e => e.status === 409);
      await assert.rejects(api.request(input('2026-11-19', '2026-11-21'), B), e => e.status === 409);
      const next = await api.request(input('2026-11-22', '2026-11-23'), B);
      assert.equal(next.booking.status, 'requested');
      assert.equal((await db.query('SELECT count(*)::int n FROM jshouse_bookings')).rows[0].n, 2);
    });

    await t.test('input, lead time, window, stay length and guest limits are enforced', async () => {
      await assert.rejects(api.request(input('2026-11-16', '2026-11-17'), B), /예약 가능한 날짜/); // 당일 (준비일 1일)
      await assert.rejects(api.request(input('2027-05-15', '2027-05-17'), B), /예약 가능한 날짜/); // 공개 기간 밖
      await assert.rejects(api.request(input('2026-12-01', '2026-12-20'), B), /숙박 기간/);          // 최대 14박 초과
      await assert.rejects(api.request(input('2026-12-01', '2026-12-01'), B), /숙박 기간/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { guests: 5 }), B), /인원/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { guestPhone: '02-123-4567' }), B), /휴대폰/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { guestName: 'A' }), B), /이름/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { agreed: false }), B), /동의/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { requestId: 'nope' }), B), /다시 진행/);
      await assert.rejects(api.request(input('2026-02-30', '2026-12-02'), B), /올바른 날짜/);
    });

    await t.test('one browser cannot pile up unconfirmed requests', async () => {
      await api.request(input('2026-12-05', '2026-12-06'), A);
      await assert.rejects(api.request(input('2026-12-08', '2026-12-09'), A), e => e.status === 409 && /기다리는/.test(e.message));
    });

    await t.test('lookup needs the matching phone and is rate limited', async () => {
      const found = await api.lookup({ code: first.code.toLowerCase().replace('-', ''), phone: '01012345678' }, B);
      assert.equal(found.booking.code, first.code); assert.equal(found.changed, null);
      await assert.rejects(api.lookup({ code: first.code, phone: '01099998888' }, B), e => e.status === 404);
      for (let i = 0; i < 9; i++) await assert.rejects(api.lookup({ code: 'JS-ZZZZZZ', phone: '01012345678' }, 'attacker'), e => e.status === 404);
      await assert.rejects(api.lookup({ code: 'JS-ZZZZZZ', phone: '01012345678' }, 'attacker'), e => e.status === 404);
      await assert.rejects(api.lookup({ code: 'JS-ZZZZZZ', phone: '01012345678' }, 'attacker'), e => e.status === 429);
    });

    await t.test('the browser that requested sees its own active requests', async () => {
      assert.deepEqual((await api.mine(A)).map(b => b.checkIn).sort(), ['2026-11-20', '2026-12-05']);
      assert.equal((await api.mine('someone-else')).length, 0);
    });

    let rowId;
    await t.test('operator confirms: nights stay held, repeat is harmless, invalid moves are refused', async () => {
      rowId = (await db.query('SELECT id FROM jshouse_bookings WHERE code=$1', [first.code])).rows[0].id;
      const done = await api.decide({ id: rowId, action: 'confirm', note: '입금 확인 예정' });
      assert.equal(done.changed, true); assert.equal(done.booking.status, 'confirmed');
      assert.equal((await api.decide({ id: rowId, action: 'confirm' })).changed, false);
      await assert.rejects(api.decide({ id: rowId, action: 'decline' }), e => e.status === 409);
      await assert.rejects(api.decide({ id: rowId, action: 'delete' }), /잘못된 요청/);
      assert.ok((await nights()).includes('2026-11-20'));
    });

    await t.test('guest cancel: confirmed stay becomes a cancel request, pending request is released', async () => {
      const asked = await api.guestCancel({ code: first.code, phone: '01012345678' }, A);
      assert.equal(asked.booking.status, 'confirmed'); assert.equal(asked.booking.cancelRequested, true); assert.equal(asked.changed, true);
      assert.equal((await api.guestCancel({ code: first.code, phone: '01012345678' }, A)).changed, false);
      const pending = (await api.mine(A)).find(b => b.checkIn === '2026-12-05');
      const gone = await api.guestCancel({ code: pending.code, phone: '01012345678' }, A);
      assert.equal(gone.booking.status, 'cancelled');
      assert.equal((await nights()).includes('2026-12-05'), false);
    });

    await t.test('operator cancel or decline frees the nights for the next guest', async () => {
      const cancelled = await api.decide({ id: rowId, action: 'cancel' });
      assert.equal(cancelled.booking.status, 'cancelled'); assert.equal(cancelled.booking.cancelRequested, false);
      assert.equal((await nights()).includes('2026-11-20'), false);
      const again = await api.request(input('2026-11-20', '2026-11-22'), 'guest-browser-C');
      const id = (await db.query('SELECT id FROM jshouse_bookings WHERE code=$1', [again.booking.code])).rows[0].id;
      assert.equal((await api.decide({ id, action: 'decline', note: '공사 일정' })).booking.status, 'declined');
      assert.equal((await nights()).includes('2026-11-21'), false);
    });

    await t.test('closed days block requests; prices appear only after the operator sets them', async () => {
      await api.setDays({ start: '2026-12-24', end: '2026-12-25', closed: true, note: '휴무' });
      await assert.rejects(api.request(input('2026-12-23', '2026-12-25'), 'guest-browser-D'), e => e.status === 409);
      assert.deepEqual((await api.calendar()).closed, ['2026-12-24', '2026-12-25']);
      await api.saveConfig({ ...core.DEFAULT_CONFIG, weekdayPrice: 180000, weekendPrice: 230000, notifyPhone: '010-2222-3333', checkInTime: '15:00' });
      await api.setDays({ start: '2026-12-31', end: '2026-12-31', closed: false, price: 300000 });
      const cal = await api.calendar();
      assert.equal(cal.config.weekdayPrice, 180000); assert.equal(cal.prices['2026-12-31'], 300000); assert.equal('notifyPhone' in cal.config, false);
      // 12/30(수) 18만 + 12/31(목) 별도 30만 + 1/1(금) 23만
      const priced = await api.request(input('2026-12-30', '2027-01-02'), 'guest-browser-D');
      assert.deepEqual(priced.booking.estimate.nightly.map(n => n.price), [180000, 300000, 230000]);
      assert.equal(priced.booking.estimate.total, 710000);
      assert.equal(priced.config.notifyPhone, '01022223333');
      await api.setDays({ start: '2026-12-24', end: '2026-12-25', clear: true });
      assert.deepEqual((await api.calendar()).closed, []);
    });

    await t.test('operator can pause requests and enter outside bookings directly', async () => {
      await api.saveConfig({ ...core.DEFAULT_CONFIG, open: false });
      await assert.rejects(api.request(input('2027-01-10', '2027-01-11'), 'guest-browser-E'), e => e.status === 409);
      const manual = await api.adminCreate({ checkIn: '2027-01-10', checkOut: '2027-01-12', guests: 3, guestName: '전화 예약', guestPhone: '', memo: '' });
      assert.equal(manual.booking.status, 'confirmed');
      await assert.rejects(api.adminCreate({ checkIn: '2027-01-11', checkOut: '2027-01-13', guests: 2, guestName: '겹침', guestPhone: '' }), e => e.status === 409);
      await api.saveConfig({ ...core.DEFAULT_CONFIG });
      await assert.rejects(api.request(input('2027-01-11', '2027-01-12'), 'guest-browser-E'), e => e.status === 409);
    });

    await t.test('settings are validated and the admin view lists everything', async () => {
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, weekendPrice: 200000 }), /주중 1박 요금/);
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, checkInTime: '3pm' }), /15:00 형식/);
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, mapUrl: 'javascript:alert(1)' }), /https/);
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, maxGuests: 0 }), /최대 인원/);
      await assert.rejects(api.setDays({ start: '2026-12-01', end: '2028-12-01', closed: true }), /날짜 범위/);
      const view = await api.admin();
      assert.ok(view.bookings.length >= 5); assert.ok(view.events.length > 5);
      assert.ok(view.bookings.every(b => /^\d{4}-\d{2}-\d{2}$/.test(b.check_in)));
    });

    await t.test('the calendar day rolls over in Korean time', async () => {
      clock = new Date('2026-11-16T15:30:00Z'); // KST 11/17 00:30
      assert.equal((await api.calendar()).today, '2026-11-17');
    });
  } finally {
    await db.close();
  }
});

// 카드 결제 — 블랜드픽(단궁)과 같은 토스 결제 과정: 날짜 15분 확보 → 서버 승인 → 확정 → 환불 취소, 그리고 장애 복구.
test('JS House card payment ledger (isolated PostgreSQL, fake gateway)', async t => {
  const db = new PGlite();
  let queue = Promise.resolve(), clock = new Date('2026-11-16T03:00:00Z'); // KST 2026-11-16 12:00
  const query = (sql, args) => db.query(sql, args);
  const pool = { query, connect: async () => { const previous = queue; let release; queue = new Promise(r => { release = r; }); await previous; return { query, release }; } };
  // 결제 대행사 흉내 — 승인/조회/취소 호출 횟수를 세고, 응답 유실·카드 거절을 재현한다
  const payments = new Map(), calls = { confirm: 0, cancel: 0 }, fault = { confirmTimeout: false, decline: false, cancelTimeout: false };
  let keysReady = true;
  const gateway = {
    confirm: async p => {
      calls.confirm++;
      if (fault.decline) {
        payments.set(p.orderId, { orderId: p.orderId, totalAmount: p.amount, currency: 'KRW', paymentKey: p.paymentKey, status: 'ABORTED' });
        throw Object.assign(Error('card declined'), { providerCode: 'REJECT_CARD_COMPANY' });
      }
      let saved = payments.get(p.orderId);
      if (!saved) { saved = { orderId: p.orderId, totalAmount: p.amount, currency: 'KRW', paymentKey: p.paymentKey, status: 'DONE', receipt: { url: 'https://example.com/receipt' } }; payments.set(p.orderId, saved); }
      if (fault.confirmTimeout) { fault.confirmTimeout = false; throw Error('simulated timeout after approval'); }
      return saved;
    },
    lookup: async id => { if (!payments.has(id)) throw Error('not found'); return payments.get(id); },
    cancel: async (key, amount, reason, id) => {
      calls.cancel++;
      const p = payments.get(id); assert.equal(p.paymentKey, key);
      p.status = amount === p.totalAmount ? 'CANCELED' : 'PARTIAL_CANCELED'; p.cancels = [{ cancelAmount: amount }];
      if (fault.cancelTimeout) { fault.cancelTimeout = false; throw Error('simulated timeout after refund'); }
      return p;
    },
  };
  const api = core.service(pool, { now: () => clock, provider: gateway, payReady: () => keysReady });
  const TERMS = '이용일 7일 전까지 전액 환불, 이후에는 환불되지 않습니다. (테스트 규정)';
  const PRICED = { ...core.DEFAULT_CONFIG, weekdayPrice: 180000, weekendPrice: 230000, refundTerms: TERMS };
  const KEY = n => `test_payment_key_${n}`;
  const stay = (checkIn, checkOut, amount, extra = {}) => ({ requestId: randomUUID(), checkIn, checkOut, guests: 2, guestName: '결제손님', guestPhone: '010-1234-5678', memo: '', agreed: true, agreedTerms: true, amount, termsKey: core.termsKey(TERMS), ...extra });
  const nights = async () => (await db.query('SELECT day::text FROM jshouse_nights ORDER BY day')).rows.map(r => r.day);
  const statusOf = async id => (await db.query('SELECT status FROM jshouse_bookings WHERE id=$1', [id])).rows[0].status;
  const later = minutes => { clock = new Date(clock.getTime() + minutes * 60000); };
  const A = 'pay-browser-A', B = 'pay-browser-B';

  try {
    await t.test('existing tables upgrade in place and keep earlier bookings', async () => {
      // 결제 연동 전 스키마(상태 4종, 결제 컬럼 없음)로 만든 뒤 최신 스키마를 덧입힌다
      const sql = fs.readFileSync(path.join(__dirname, '../scripts/jshouse.sql'), 'utf8');
      const old = sql.split('\n').filter(line => !/^ALTER TABLE|^ CHECK\(status IN \('requested','pending'|jshouse_bookings_pending/.test(line)).join('\n');
      await db.exec(old);
      await db.query(`INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,check_in,check_out,guests,guest_name,guest_phone) VALUES($1,'JS-OLDONE',$2,'legacy','confirmed','2027-02-01','2027-02-03',2,'이전 예약','01011112222')`, [randomUUID(), randomUUID()]);
      await assert.rejects(db.query("UPDATE jshouse_bookings SET status='pending' WHERE code='JS-OLDONE'"), /check/i);
      const { prepare } = require('../scripts/prepare-jshouse.cjs');
      await prepare({ query: text => db.exec(text) }); await prepare({ query: text => db.exec(text) });
      const { rows: [kept] } = await db.query("SELECT status,amount,paid_at FROM jshouse_bookings WHERE code='JS-OLDONE'");
      assert.deepEqual(kept, { status: 'confirmed', amount: null, paid_at: null });
      await assert.rejects(db.query("UPDATE jshouse_bookings SET status='bogus' WHERE code='JS-OLDONE'"), /check/i);
    });

    await t.test('card payment opens only with refund terms, live keys and the switch on', async () => {
      assert.equal((await api.calendar()).pay, false, 'no refund terms yet');
      await api.saveConfig({ ...PRICED, refundTerms: '' });
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000), A), e => e.status === 409 && /카드 결제를 받을 수 없/.test(e.message));
      await assert.rejects(api.saveConfig({ ...PRICED, payOnline: 'yes' }), /카드 결제 받기/);
      await api.saveConfig({ ...PRICED, refundTerms: '너무 짧음' });
      assert.equal((await api.calendar()).pay, false, 'terms too short to be real');
      await api.saveConfig(PRICED);
      const cal = await api.calendar();
      assert.equal(cal.pay, true); assert.equal(cal.termsKey, core.termsKey(TERMS)); assert.equal(cal.config.refundTerms, TERMS);
      keysReady = false; assert.equal((await api.calendar()).pay, false, 'live keys missing'); keysReady = true;
      await api.saveConfig({ ...PRICED, payOnline: false }); assert.equal((await api.calendar()).pay, false); await api.saveConfig(PRICED);
      assert.equal(api.payMode(await api.readConfig()), true);
      assert.equal(core.service(pool, { now: () => clock }).payMode(PRICED), false, 'no gateway → always request flow');
    });

    let held;
    await t.test('starting payment re-checks amount and terms, then holds the nights for 15 minutes', async () => {
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 350000), A), e => e.status === 409 && /요금 또는/.test(e.message));
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000, { termsKey: core.termsKey('예전 규정') }), A), e => e.status === 409);
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000, { agreedTerms: false }), A), /취소·환불 규정에 동의/);
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000, { agreed: false }), A), /개인정보/);
      assert.deepEqual(await nights(), [], 'refused attempts hold nothing');
      const req = stay('2026-11-23', '2026-11-25', 360000);
      held = await api.reserve(req, A);
      const again = await api.reserve(req, A);
      assert.equal(held.created, true); assert.equal(again.created, false); assert.equal(again.orderId, held.orderId);
      assert.equal(held.booking.status, 'pending'); assert.equal(held.payable, true); assert.equal(held.amount, 360000);
      assert.equal(held.booking.paid, false); assert.equal(held.booking.estimate.refundTerms, TERMS);
      assert.equal(new Date(held.booking.expiresAt).getTime() - clock.getTime(), core.HOLD_MINUTES * 60000);
      assert.deepEqual(await nights(), ['2026-11-23', '2026-11-24']);
      assert.deepEqual((await api.calendar()).taken, ['2026-11-23', '2026-11-24']);
      await assert.rejects(api.reserve(stay('2026-11-24', '2026-11-26', 360000), B), e => e.status === 409 && /마감/.test(e.message));
      // 결제할 수 있는 일정은 결제 없이 신청으로 들어올 수 없다
      await assert.rejects(api.request(stay('2026-11-26', '2026-11-27', 180000), B), e => e.status === 409 && /카드 결제로 바로/.test(e.message));
      assert.equal((await api.status(held.orderId, A)).booking.code, held.booking.code);
      await assert.rejects(api.status(held.orderId, B), e => e.status === 404);
      assert.equal((await api.mine(A)).length, 0, 'an unpaid hold is not listed as a booking');
    });

    await t.test('an unpaid hold expires, reopens the dates, and a late approval is refused without charging', async () => {
      later(16);
      assert.deepEqual((await api.calendar()).taken, [], 'open again even before cleanup runs');
      await assert.rejects(api.confirm({ orderId: held.orderId, paymentKey: KEY(0), amount: 360000 }), e => e.status === 409 && /승인되지 않았습니다/.test(e.message));
      assert.equal(calls.confirm, 0, 'the gateway was never asked to charge');
      const seen = await api.lookup({ code: held.booking.code, phone: '01012345678' }, A);
      assert.equal(seen.booking.status, 'expired', 'the guest sees it as not paid');
      assert.equal(await statusOf(held.orderId), 'expired'); assert.deepEqual(await nights(), []);
    });

    let paid;
    await t.test('approval confirms the stay exactly once and stores what the guest agreed to', async () => {
      const order = await api.reserve(stay('2026-11-23', '2026-11-25', 360000), A);
      await assert.rejects(api.confirm({ orderId: order.orderId, paymentKey: KEY(1), amount: 100 }), e => e.status === 409 && /금액/.test(e.message));
      await assert.rejects(api.confirm({ orderId: order.orderId, paymentKey: 'short', amount: 360000 }), /결제 정보/);
      await assert.rejects(api.confirm({ orderId: 'not-an-id', paymentKey: KEY(1), amount: 360000 }), e => e.status === 404);
      assert.equal(calls.confirm, 0);
      paid = await api.confirm({ orderId: order.orderId, paymentKey: KEY(1), amount: 360000 });
      assert.equal(paid.changed, 'confirmed'); assert.equal(paid.booking.status, 'confirmed'); assert.equal(paid.booking.paid, true);
      assert.equal(paid.booking.amount, 360000); assert.equal(paid.booking.receiptUrl, 'https://example.com/receipt'); assert.equal(paid.payable, false);
      // 다른 브라우저로 돌아와도(앱 전환) 같은 주문번호·결제키·금액이면 다시 승인하지 않고 같은 결과를 돌려준다
      const repeat = await api.confirm({ orderId: order.orderId, paymentKey: KEY(1), amount: 360000 });
      assert.equal(repeat.changed, null); assert.equal(repeat.booking.status, 'confirmed'); assert.equal(calls.confirm, 1);
      await assert.rejects(api.confirm({ orderId: order.orderId, paymentKey: KEY(999), amount: 360000 }), e => e.status === 409);
      later(30);
      assert.deepEqual(await nights(), ['2026-11-23', '2026-11-24'], 'paid nights never expire');
      await api.saveConfig({ ...PRICED, refundTerms: TERMS + ' (개정)' });
      assert.equal((await api.status(order.orderId, A)).booking.estimate.refundTerms, TERMS, 'later edits do not rewrite the agreed terms');
      await api.saveConfig(PRICED);
      assert.deepEqual((await api.mine(A)).map(b => b.code), [paid.booking.code]);
      // 결제한 예약은 환불 금액을 정하지 않고는 취소할 수 없다
      await assert.rejects(api.decide({ id: order.orderId, action: 'cancel' }), e => e.status === 409 && /환불 금액/.test(e.message));
      await assert.rejects(api.decide({ id: order.orderId, action: 'decline' }), e => e.status === 409);
    });

    let weekend;
    await t.test('a lost approval response keeps the dates and is settled by re-checking, never by paying twice', async () => {
      weekend = await api.reserve(stay('2026-11-27', '2026-11-29', 460000), B); // 금·토 23만 × 2
      fault.confirmTimeout = true;
      await assert.rejects(api.confirm({ orderId: weekend.orderId, paymentKey: KEY(2), amount: 460000 }), /simulated timeout/);
      assert.equal(await statusOf(weekend.orderId), 'confirming');
      later(60);
      assert.ok((await api.calendar()).taken.includes('2026-11-27'), 'dates under confirmation are never auto-released');
      assert.equal((await api.status(weekend.orderId, B)).booking.status, 'confirming');
      await assert.rejects(api.reconcile(weekend.orderId, A), e => e.status === 404);
      const settled = await api.reconcile(weekend.orderId, B);
      assert.equal(settled.changed, 'confirmed'); assert.equal(settled.booking.paid, true);
      assert.equal((await api.reconcile(weekend.orderId)).changed, null);
      assert.equal(calls.confirm, 2, 'one approval call per booking');
    });

    await t.test('a lookup by booking number also settles a payment still being confirmed', async () => {
      const order = await api.reserve(stay('2026-12-09', '2026-12-10', 180000), 'pay-browser-L');
      fault.confirmTimeout = true;
      await assert.rejects(api.confirm({ orderId: order.orderId, paymentKey: KEY(3), amount: 180000 }));
      const found = await api.lookup({ code: order.booking.code, phone: '01012345678' }, 'another-device');
      assert.equal(found.changed, 'confirmed'); assert.equal(found.booking.status, 'confirmed');
    });

    await t.test('a declined card releases the dates at once', async () => {
      const order = await api.reserve(stay('2026-12-01', '2026-12-02', 180000), A);
      fault.decline = true;
      const result = await api.confirm({ orderId: order.orderId, paymentKey: KEY(4), amount: 180000 });
      fault.decline = false;
      assert.equal(result.changed, 'expired'); assert.equal(result.booking.status, 'expired'); assert.equal(result.booking.paid, false);
      assert.equal((await nights()).includes('2026-12-01'), false);
    });

    await t.test('closing the payment window gives the dates back; starting over clears the same browser\'s stale hold', async () => {
      const order = await api.reserve(stay('2026-12-03', '2026-12-04', 180000), A);
      await assert.rejects(api.abandon(order.orderId, B), e => e.status === 404);
      assert.equal((await api.abandon(order.orderId, A)).booking.status, 'expired');
      assert.equal((await nights()).includes('2026-12-03'), false);
      assert.equal((await api.abandon(paid.orderId, A)).booking.status, 'confirmed', 'a paid booking cannot be abandoned');
      // 결제창에서 새로고침한 뒤 같은 날짜를 다시 시도 — 자기 자신이 잡아 둔 날짜에 막히지 않는다
      const first = await api.reserve(stay('2026-12-03', '2026-12-04', 180000), A);
      const second = await api.reserve(stay('2026-12-03', '2026-12-04', 180000), A);
      assert.notEqual(second.orderId, first.orderId); assert.equal(await statusOf(first.orderId), 'expired'); assert.equal(second.booking.status, 'pending');
      // 예약 조회에서 결제하지 않고 닫기
      const closed = await api.guestCancel({ code: second.booking.code, phone: '01012345678' }, A);
      assert.equal(closed.booking.status, 'expired'); assert.equal((await nights()).includes('2026-12-03'), false);
    });

    await t.test('guest asks to cancel; the operator refunds the agreed amount and the dates reopen', async () => {
      const asked = await api.guestCancel({ code: paid.booking.code, phone: '01012345678' }, A);
      assert.equal(asked.booking.status, 'confirmed'); assert.equal(asked.booking.cancelRequested, true);
      await assert.rejects(api.refund({ id: paid.orderId, amount: 360001, reason: '고객 요청' }), /환불 금액/);
      await assert.rejects(api.refund({ id: paid.orderId, amount: -1, reason: '고객 요청' }), /환불 금액/);
      await assert.rejects(api.refund({ id: paid.orderId, amount: 180000, reason: ' ' }), /취소 사유/);
      assert.equal(calls.cancel, 0);
      const done = await api.refund({ id: paid.orderId, amount: 180000, reason: '고객 요청' });
      assert.equal(done.changed, 'cancelled'); assert.equal(done.booking.status, 'cancelled'); assert.equal(done.booking.refundAmount, 180000); assert.equal(done.booking.cancelRequested, false);
      assert.equal((await nights()).includes('2026-11-23'), false);
      assert.equal((await api.refund({ id: paid.orderId, amount: 180000, reason: '고객 요청' })).changed, null);
      assert.equal(calls.cancel, 1, 'one refund call per booking');
      assert.equal((await api.reserve(stay('2026-11-23', '2026-11-25', 360000), 'pay-browser-C')).booking.status, 'pending', 'the next guest can book the freed dates');
    });

    await t.test('cancelling without a refund never calls the gateway; a lost refund response is recovered', async () => {
      const kept = await api.refund({ id: weekend.orderId, amount: 0, reason: '당일 취소 (환불 없음)' });
      assert.equal(kept.changed, 'cancelled'); assert.equal(kept.booking.refundAmount, 0); assert.equal(calls.cancel, 1);
      assert.equal((await nights()).includes('2026-11-27'), false);
      const order = await api.reserve(stay('2026-12-07', '2026-12-08', 180000), B);
      await api.confirm({ orderId: order.orderId, paymentKey: KEY(5), amount: 180000 });
      fault.cancelTimeout = true;
      await assert.rejects(api.refund({ id: order.orderId, amount: 180000, reason: '숙소 사정' }), /simulated timeout/);
      assert.equal(await statusOf(order.orderId), 'cancelling');
      assert.ok((await nights()).includes('2026-12-07'), 'dates stay held until the refund is confirmed');
      await assert.rejects(api.refund({ id: order.orderId, amount: 90000, reason: '숙소 사정' }), e => e.status === 409 && /진행 중인 취소/.test(e.message));
      const settled = await api.reconcile(order.orderId);
      assert.equal(settled.changed, 'cancelled'); assert.equal(settled.booking.refundAmount, 180000);
      assert.equal((await nights()).includes('2026-12-07'), false);
      await assert.rejects(api.refund({ id: (await db.query("SELECT id FROM jshouse_bookings WHERE code='JS-OLDONE'")).rows[0].id, amount: 0, reason: '결제 없는 예약' }), e => e.status === 409 && /카드로 결제한 예약만/.test(e.message));
    });

    await t.test('mismatched gateway answers never confirm a booking', async () => {
      const order = await api.reserve(stay('2026-12-14', '2026-12-15', 180000), B);
      payments.set(order.orderId, { orderId: order.orderId, totalAmount: 1000, currency: 'KRW', paymentKey: KEY(6), status: 'DONE' });
      await assert.rejects(api.confirm({ orderId: order.orderId, paymentKey: KEY(6), amount: 180000 }), e => e.status === 409 && /일치하지 않습니다/.test(e.message));
      assert.equal(await statusOf(order.orderId), 'confirming', 'left for the operator to inspect, never marked paid');
      assert.equal((await db.query('SELECT paid_at FROM jshouse_bookings WHERE id=$1', [order.orderId])).rows[0].paid_at, null);
    });

    await t.test('nights without a price still take requests; the admin view shows payment facts', async () => {
      await api.saveConfig({ ...PRICED, weekdayPrice: null, weekendPrice: null });
      await api.setDays({ start: '2026-12-21', end: '2026-12-21', closed: false, price: 200000 });
      // 12/21 만 요금이 있고 12/22 는 없음 → 결제 불가, 신청으로 접수
      await assert.rejects(api.reserve(stay('2026-12-21', '2026-12-23', 200000), 'pay-browser-D'), e => e.status === 409 && /요금이 정해지지 않은/.test(e.message));
      const requested = await api.request(stay('2026-12-21', '2026-12-23', 0), 'pay-browser-D');
      assert.equal(requested.booking.status, 'requested'); assert.equal(requested.booking.amount, null); assert.equal(requested.booking.paid, false);
      // 요금이 있는 하루만 고르면 결제로 받는다
      await api.setDays({ start: '2026-12-28', end: '2026-12-28', closed: false, price: 200000 });
      assert.equal((await api.reserve(stay('2026-12-28', '2026-12-29', 200000), 'pay-browser-D')).booking.status, 'pending');
      const view = await api.admin();
      assert.equal(view.pay, true); assert.equal(view.termsReady, true);
      const row = view.bookings.find(b => b.code === paid.booking.code);
      assert.equal(row.amount, 360000); assert.equal(row.refund_amount, 180000); assert.equal(row.cancel_reason, '고객 요청'); assert.ok(row.paid_at);
      for (const action of ['pay_started', 'confirming', 'paid', 'pay_failed', 'pay_abandoned', 'cancelling', 'refunded', 'cancelled_without_refund']) {
        assert.ok((await db.query('SELECT 1 FROM jshouse_events WHERE action=$1 LIMIT 1', [action])).rows.length, `event ${action} recorded`);
      }
    });
  } finally {
    await db.close();
  }
});
