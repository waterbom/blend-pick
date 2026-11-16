// JS하우스 예약 신청 원장 — 격리된 PGlite(PostgreSQL)에서 전체 흐름을 검증한다. 운영 DB·문자 발송 없음.
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
      assert.equal(found.code, first.code);
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
