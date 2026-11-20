// LIMEN 예약 원장 — 격리된 PGlite(PostgreSQL)에서 예약 신청과 카드 결제 전체 흐름을 검증한다. 운영 DB·문자 발송·실제 결제 없음.
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const core = require('../lib/limen-core.cjs');

test('LIMEN booking request ledger (isolated PostgreSQL)', async t => {
  const db = new PGlite();
  let queue = Promise.resolve(), clock = new Date('2026-11-16T03:00:00Z'); // KST 2026-11-16 12:00
  const query = (sql, args) => db.query(sql, args);
  // 한 연결을 순서대로 쓰게 해서 트랜잭션이 섞이지 않게 한다
  const pool = { query, connect: async () => { const previous = queue; let release; queue = new Promise(r => { release = r; }); await previous; return { query, release }; } };
  const api = core.service(pool, { now: () => clock });
  const A = 'guest-browser-A', B = 'guest-browser-B';
  // 따로 적지 않으면 투룸(4인) 예약
  const input = (checkIn, checkOut, extra = {}) => ({ requestId: randomUUID(), room: 'two', checkIn, checkOut, guests: 2, guestName: '테스트손님', guestPhone: '010-1234-5678', memo: '', agreed: true, ...extra });
  const nights = async (room = 'two') => (await db.query('SELECT day::text FROM jshouse_nights WHERE room=$1 ORDER BY day', [room])).rows.map(r => r.day);

  try {
    await t.test('schema is repeatable and starts open with the rates the stay sent', async () => {
      const { prepare } = require('../scripts/prepare-limen.cjs');
      const run = () => prepare({ query: sql => db.exec(sql) });
      await run(); await run();
      const c = await api.calendar();
      assert.equal(c.today, '2026-11-16'); assert.equal(c.lastDay, '2027-05-15');
      assert.equal(c.config.open, true);
      assert.deepEqual(c.config.rooms.one, { open: true, guests: 2, weekday: 200000, friday: 230000, saturday: 250000, shoulder: 270000, peak: 300000 });
      assert.deepEqual(c.config.rooms.two, { open: true, guests: 4, weekday: 350000, friday: 380000, saturday: 400000, shoulder: 420000, peak: 450000 });
      assert.equal('notifyPhone' in c.config, false, 'operator phone must stay private');
      for (const room of ['one', 'two']) { assert.deepEqual(c.rooms[room].taken, []); assert.deepEqual(c.rooms[room].closed, []); }
      // 시즌 달력이 기본으로 켜져 있다: 달력 기간(11/16–5/15) 안에는 연말 12/20–12/31 과 설 연휴 2/5–2/8 밤이 시즌이다
      assert.equal(c.config.autoSeasons, true); assert.deepEqual(c.rooms.one.seasons, c.rooms.two.seasons);
      assert.deepEqual(Object.keys(c.rooms.one.seasons), [...Array.from({ length: 12 }, (_, i) => `2026-12-${20 + i}`), '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08']);
      assert.deepEqual(['2026-12-20', '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-31', '2027-02-05'].map(d => c.rooms.one.seasons[d]), ['shoulder', 'peak', 'peak', 'shoulder', 'peak', 'shoulder']);
      // 달력은 날짜마다 그날의 1박 요금을 내려준다: 11/19(목) 주중 · 11/20(금) · 11/21(토)
      assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21'].map(d => c.rooms.one.prices[d]), [200000, 230000, 250000]);
      assert.deepEqual(['2026-11-19', '2026-11-20', '2026-11-21'].map(d => c.rooms.two.prices[d]), [350000, 380000, 400000]);
      assert.equal(Object.keys(c.rooms.one.prices).length, 181);
    });

    let first;
    await t.test('a request holds its nights at once and repeats safely', async () => {
      const req = input('2026-11-20', '2026-11-22');
      const one = await api.request(req, A), two = await api.request(req, A);
      first = one.booking;
      assert.equal(one.created, true); assert.equal(two.created, false); assert.equal(two.booking.code, first.code);
      assert.match(first.code, /^LM-[A-Z2-9]{6}$/); assert.equal(first.status, 'requested'); assert.equal(first.nights, 2);
      assert.equal(first.room, 'two'); assert.equal(first.roomName, '투룸');
      assert.equal(first.estimate.total, 780000, '투룸 금 380,000 + 토 400,000');
      assert.deepEqual(first.estimate.nightly.map(n => n.rate), ['friday', 'saturday']);
      assert.deepEqual(await nights(), ['2026-11-20', '2026-11-21']);
      const cal = await api.calendar();
      assert.deepEqual(cal.rooms.two.taken, ['2026-11-20', '2026-11-21']);
      assert.deepEqual(cal.rooms.one.taken, [], 'the other room stays open');
    });

    await t.test('overlapping stays are refused; the checkout day can start another stay', async () => {
      await assert.rejects(api.request(input('2026-11-21', '2026-11-23'), B), e => e.status === 409);
      await assert.rejects(api.request(input('2026-11-19', '2026-11-21'), B), e => e.status === 409);
      const next = await api.request(input('2026-11-22', '2026-11-23'), B);
      assert.equal(next.booking.status, 'requested');
      assert.equal((await db.query('SELECT count(*)::int n FROM jshouse_bookings')).rows[0].n, 2);
      // 원룸은 다른 공간이라 같은 밤에도 따로 예약된다
      const other = await api.request(input('2026-11-20', '2026-11-22', { room: 'one' }), 'guest-browser-R');
      assert.equal(other.booking.roomName, '원룸'); assert.equal(other.booking.estimate.total, 480000, '원룸 금 230,000 + 토 250,000');
      assert.deepEqual(await nights('one'), ['2026-11-20', '2026-11-21']);
      await assert.rejects(api.request(input('2026-11-21', '2026-11-22', { room: 'one' }), B), e => e.status === 409);
    });

    await t.test('input, lead time, window, stay length and guest limits are enforced', async () => {
      await assert.rejects(api.request(input('2026-11-16', '2026-11-17'), B), /예약 가능한 날짜/); // 당일 (준비일 1일)
      await assert.rejects(api.request(input('2027-05-15', '2027-05-17'), B), /예약 가능한 날짜/); // 공개 기간 밖
      await assert.rejects(api.request(input('2026-12-01', '2026-12-20'), B), /숙박 기간/);          // 최대 14박 초과
      await assert.rejects(api.request(input('2026-12-01', '2026-12-01'), B), /숙박 기간/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { guests: 5 }), B), /투룸은 최대 4명/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { room: 'one', guests: 3 }), B), /원룸은 최대 2명/); // 인원 추가 불가
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { guests: 0 }), B), /인원/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { room: 'three' }), B), /객실을 선택/);
      await assert.rejects(api.request(input('2026-12-01', '2026-12-02', { room: undefined }), B), /객실을 선택/);
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
      // 브랜드명 확정 전에 발급한 JS- 번호도 계속 조회된다
      await db.query("UPDATE jshouse_bookings SET code='JS-AB2CD3' WHERE code=$1", [(await api.mine(A)).find(b => b.checkIn === '2026-12-05').code]);
      assert.equal((await api.lookup({ code: 'jsab2cd3', phone: '01012345678' }, 'old-link')).booking.code, 'JS-AB2CD3');
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

    await t.test('closing dates, seasons and one-off prices apply per room and change only what was asked', async () => {
      await api.setDays({ rooms: ['two'], start: '2026-12-24', end: '2026-12-25', closed: true, note: '휴무' });
      await assert.rejects(api.request(input('2026-12-23', '2026-12-25'), 'guest-browser-D'), e => e.status === 409);
      let cal = await api.calendar();
      assert.deepEqual(cal.rooms.two.closed, ['2026-12-24', '2026-12-25']); assert.deepEqual(cal.rooms.one.closed, [], 'closing one room leaves the other open');
      assert.equal((await api.request(input('2026-12-24', '2026-12-25', { room: 'one' }), 'guest-browser-D')).booking.status, 'requested');
      // 시즌 지정: 12/28–1/3 극성수기(두 객실), 1/4–1/6 준성수기(투룸만) — 요일과 상관없이 그 요금
      await api.setDays({ rooms: ['one', 'two'], start: '2026-12-28', end: '2027-01-03', season: 'peak' });
      await api.setDays({ rooms: ['two'], start: '2027-01-04', end: '2027-01-06', season: 'shoulder' });
      // 12/31 투룸만 그날의 요금을 따로 지정 (프로모션 등)
      await api.setDays({ rooms: ['two'], start: '2026-12-31', end: '2026-12-31', price: 500000 });
      cal = await api.calendar();
      assert.equal(cal.rooms.one.prices['2026-12-30'], 300000); assert.equal(cal.rooms.two.prices['2026-12-30'], 450000);
      assert.equal(cal.rooms.two.prices['2026-12-31'], 500000); assert.equal(cal.rooms.one.prices['2026-12-31'], 300000);
      assert.equal(cal.rooms.two.prices['2027-01-05'], 420000); assert.equal(cal.rooms.one.prices['2027-01-05'], 200000);
      assert.equal(cal.rooms.two.seasons['2026-12-31'], 'peak', 'a one-off price keeps the season label'); assert.equal(cal.rooms.two.seasons['2027-01-05'], 'shoulder');
      assert.equal('notifyPhone' in cal.config, false);
      // 12/30(극성수기 45만) + 12/31(지정 50만) + 1/1(극성수기 45만)
      const priced = await api.request(input('2026-12-30', '2027-01-02'), 'guest-browser-E');
      assert.deepEqual(priced.booking.estimate.nightly.map(n => [n.price, n.rate]), [[450000, 'peak'], [500000, 'custom'], [450000, 'peak']]);
      assert.equal(priced.booking.estimate.total, 1400000);
      // 닫기만 바꾸면 시즌은 그대로 남는다
      await api.setDays({ rooms: ['one'], start: '2026-12-29', end: '2026-12-29', closed: true });
      cal = await api.calendar();
      assert.deepEqual(cal.rooms.one.closed, ['2026-12-29']); assert.equal(cal.rooms.one.seasons['2026-12-29'], 'peak');
      await api.setDays({ rooms: ['two'], start: '2026-12-31', end: '2026-12-31', price: null });
      assert.equal((await api.calendar()).rooms.two.prices['2026-12-31'], 450000, 'removing the one-off price falls back to the season rate');
      await api.setDays({ rooms: ['one', 'two'], start: '2026-12-24', end: '2026-12-29', clear: true });
      cal = await api.calendar();
      assert.deepEqual(cal.rooms.two.closed, []); assert.deepEqual(cal.rooms.one.closed, []);
      assert.equal(cal.rooms.one.prices['2026-12-28'], 270000, 'cleared days go back to the season calendar (12/28 준성수기)');
      await assert.rejects(api.setDays({ rooms: [], start: '2026-12-01', end: '2026-12-02', closed: true }), /객실을 선택/);
      await assert.rejects(api.setDays({ rooms: ['two'], start: '2026-12-01', end: '2026-12-02', season: 'holiday' }), /시즌/);
      await assert.rejects(api.setDays({ rooms: ['two'], start: '2026-12-01', end: '2026-12-02' }), /바꿀 내용/);
    });

    await t.test('the season calendar sets peak, shoulder and holiday-eve nights; the operator can pin a day or switch it off', async () => {
      await api.setDays({ rooms: ['one', 'two'], start: '2026-12-20', end: '2027-01-06', clear: true });
      let cal = await api.calendar();
      // 12/19(토) 토요일 · 12/20(일) 준성수기 · 12/24(목) 극성수기 · 12/26(토) 준성수기 · 12/31(목) 극성수기 · 1/1(금) 금요일 · 1/4(월) 주중
      assert.deepEqual(['2026-12-19', '2026-12-20', '2026-12-24', '2026-12-26', '2026-12-31', '2027-01-01', '2027-01-04'].map(d => cal.rooms.one.prices[d]), [250000, 270000, 300000, 270000, 300000, 230000, 200000]);
      assert.deepEqual(['2026-12-20', '2026-12-24', '2027-01-01'].map(d => cal.rooms.two.prices[d]), [420000, 450000, 380000]);
      // 설 연휴(2/6–2/9): 전날 밤 2/5 부터 2/8 밤까지 준성수기, 2/9(화) 밤은 주중
      assert.deepEqual(['2027-02-04', '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09'].map(d => cal.rooms.one.prices[d]), [200000, 270000, 270000, 270000, 270000, 200000]);
      // 평일 공휴일 전날은 토요일 요금: 2/28(일, 삼일절 전날) · 5/2(일, 노동절 대체공휴일 전날) · 5/4(화, 어린이날 전날) · 5/12(수, 부처님오신날 전날)
      assert.deepEqual(['2027-02-28', '2027-05-02', '2027-05-04', '2027-05-12'].map(d => cal.rooms.one.prices[d]), [250000, 250000, 250000, 250000]);
      assert.equal(cal.rooms.one.prices['2027-04-30'], 230000, 'a holiday on a Saturday leaves Friday at the Friday rate');
      assert.equal('2027-02-28' in cal.rooms.one.seasons, false, 'a holiday eve is priced as Saturday but is not a season');
      // 운영자가 지정한 날이 먼저: 12/24 를 원룸만 평시로 고정, 11/30(월)을 극성수기로
      await api.setDays({ rooms: ['one'], start: '2026-12-24', end: '2026-12-24', season: 'normal' });
      await api.setDays({ rooms: ['one'], start: '2026-11-30', end: '2026-11-30', season: 'peak' });
      cal = await api.calendar();
      assert.equal(cal.rooms.one.prices['2026-12-24'], 200000); assert.equal('2026-12-24' in cal.rooms.one.seasons, false); assert.equal(cal.rooms.two.prices['2026-12-24'], 450000);
      assert.equal(cal.rooms.one.prices['2026-11-30'], 300000); assert.equal(cal.rooms.one.seasons['2026-11-30'], 'peak');
      // 예약 금액도 같은 계산: 원룸 12/30(준성수기 27만) + 12/31(극성수기 30만) + 1/1(금 23만), 밤마다 성수기·주말 구분이 남는다
      const stay = await api.request(input('2026-12-30', '2027-01-02', { room: 'one' }), 'guest-browser-S');
      assert.deepEqual(stay.booking.estimate.nightly.map(n => [n.price, n.rate, n.season, n.weekend]), [[270000, 'shoulder', 'shoulder', false], [300000, 'peak', 'peak', true], [230000, 'friday', '', true]]);
      assert.equal(stay.booking.estimate.total, 800000);
      // 관리자 블럭표도 같은 값을 받는다 (이번 달 1일부터)
      const chart = (await api.admin()).chart;
      assert.deepEqual(chart.one['2026-12-24'], { price: 200000, rate: 'weekday', manual: true }); assert.deepEqual(chart.one['2026-11-30'], { price: 300000, rate: 'peak', season: 'peak', manual: true });
      assert.deepEqual(chart.two['2026-12-24'], { price: 450000, rate: 'peak', season: 'peak' }); assert.deepEqual(chart.two['2027-02-28'], { price: 400000, rate: 'saturday' });
      assert.ok('2026-11-01' in chart.one && '2027-11-30' in chart.one, 'twelve months from the first of this month');
      // 자동 적용을 끄면 지정한 날에만 시즌 요금을 받는다
      await api.saveConfig({ ...core.DEFAULT_CONFIG, autoSeasons: false });
      cal = await api.calendar();
      assert.deepEqual(['2026-12-20', '2026-12-31', '2027-02-05', '2027-02-28', '2026-11-30'].map(d => cal.rooms.one.prices[d]), [200000, 200000, 230000, 200000, 300000]);
      assert.deepEqual(cal.rooms.two.seasons, {}); assert.deepEqual(cal.rooms.one.seasons, { '2026-11-30': 'peak' });
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, autoSeasons: 'yes' }), /성수기 자동 적용/);
      await api.saveConfig({ ...core.DEFAULT_CONFIG });
      await api.setDays({ rooms: ['one'], start: '2026-11-30', end: '2026-12-24', clear: true });
      await api.decide({ id: stay.row.id, action: 'cancel' });
    });

    await t.test('the operator edits the rate table; an empty rate means that night has no price', async () => {
      const rooms = { one: { ...core.DEFAULT_ROOMS.one, weekday: 210000, saturday: null }, two: { ...core.DEFAULT_ROOMS.two, guests: 3 } };
      await api.saveConfig({ ...core.DEFAULT_CONFIG, rooms, notifyPhone: '010-2222-3333', checkInTime: '15:00' });
      const cal = await api.calendar();
      assert.equal(cal.config.rooms.one.weekday, 210000); assert.equal(cal.rooms.one.prices['2027-01-13'], 210000);
      assert.equal(cal.rooms.one.prices['2027-01-16'], null, '토요일 요금을 비웠다');
      const open = await api.request(input('2027-01-15', '2027-01-17', { room: 'one' }), 'guest-browser-F');
      assert.equal(open.booking.estimate.total, null, 'no invented total when a night has no price'); assert.equal(open.config.notifyPhone, '01022223333');
      await assert.rejects(api.request(input('2027-01-20', '2027-01-21', { guests: 4 }), 'guest-browser-F'), /투룸은 최대 3명/);
      // 저장된 값이 없는 칸은 요금표 기본값으로 채워진다 (설정에 객실 항목이 없던 이전 버전 포함)
      assert.deepEqual(core.mergeConfig({ rooms: { one: { weekday: 1000 } }, weekdayPrice: 5, maxGuests: 9 }).rooms, { one: { ...core.DEFAULT_ROOMS.one, weekday: 1000 }, two: { ...core.DEFAULT_ROOMS.two } });
      assert.equal('weekdayPrice' in core.mergeConfig({ weekdayPrice: 5 }), false);
      await api.saveConfig({ ...core.DEFAULT_CONFIG, rooms: { ...core.DEFAULT_ROOMS, one: { ...core.DEFAULT_ROOMS.one, open: false } } });
      await assert.rejects(api.request(input('2027-02-01', '2027-02-02', { room: 'one' }), 'guest-browser-F'), e => e.status === 409 && /원룸 예약을 받지 않/.test(e.message));
      assert.equal((await api.request(input('2027-02-01', '2027-02-02'), 'guest-browser-G')).booking.status, 'requested');
    });

    await t.test('operator can pause requests and enter outside bookings directly', async () => {
      await api.saveConfig({ ...core.DEFAULT_CONFIG, open: false });
      await assert.rejects(api.request(input('2027-01-10', '2027-01-11'), 'guest-browser-E'), e => e.status === 409);
      const manual = await api.adminCreate({ room: 'two', checkIn: '2027-01-10', checkOut: '2027-01-12', guests: 3, guestName: '전화 예약', guestPhone: '', memo: '' });
      assert.equal(manual.booking.status, 'confirmed'); assert.equal(manual.booking.room, 'two');
      await assert.rejects(api.adminCreate({ room: 'two', checkIn: '2027-01-11', checkOut: '2027-01-13', guests: 2, guestName: '겹침', guestPhone: '' }), e => e.status === 409);
      assert.equal((await api.adminCreate({ room: 'one', checkIn: '2027-01-11', checkOut: '2027-01-13', guests: 2, guestName: '다른 객실', guestPhone: '' })).booking.room, 'one');
      await assert.rejects(api.adminCreate({ checkIn: '2027-01-20', checkOut: '2027-01-21', guests: 2, guestName: '객실 없음', guestPhone: '' }), /객실을 선택/);
      await api.saveConfig({ ...core.DEFAULT_CONFIG });
      await assert.rejects(api.request(input('2027-01-11', '2027-01-12'), 'guest-browser-E'), e => e.status === 409);
    });

    await t.test('settings are validated and the admin view lists everything', async () => {
      const withRoom = (key, patch) => ({ ...core.DEFAULT_CONFIG, rooms: { ...core.DEFAULT_ROOMS, [key]: { ...core.DEFAULT_ROOMS[key], ...patch } } });
      await assert.rejects(api.saveConfig(withRoom('one', { weekday: -1 })), /원룸 주중\(일–목\) 요금/);
      await assert.rejects(api.saveConfig(withRoom('two', { peak: 1.5 })), /투룸 극성수기 요금/);
      await assert.rejects(api.saveConfig(withRoom('two', { guests: 0 })), /투룸 최대 인원/);
      await assert.rejects(api.saveConfig(withRoom('one', { open: 'yes' })), /원룸 예약 받기/);
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, checkInTime: '3pm' }), /15:00 형식/);
      await assert.rejects(api.saveConfig({ ...core.DEFAULT_CONFIG, mapUrl: 'javascript:alert(1)' }), /https/);
      await assert.rejects(api.setDays({ rooms: ['two'], start: '2026-12-01', end: '2028-12-01', closed: true }), /날짜 범위/);
      const view = await api.admin();
      assert.ok(view.bookings.length >= 5); assert.ok(view.events.length > 5);
      assert.ok(view.bookings.every(b => /^\d{4}-\d{2}-\d{2}$/.test(b.check_in) && ['one', 'two'].includes(b.room)));
      assert.ok(view.days.every(d => ['one', 'two'].includes(d.room) && ['', 'normal', 'shoulder', 'peak'].includes(d.season)));
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
test('LIMEN card payment ledger (isolated PostgreSQL, fake gateway)', async t => {
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
  // 결제 흐름은 원룸으로 확인한다 (계산하기 쉬운 요금: 주중 18만 · 금·토 23만)
  const ONE = { ...core.DEFAULT_ROOMS.one, weekday: 180000, friday: 230000, saturday: 230000 };
  const PRICED = { ...core.DEFAULT_CONFIG, rooms: { one: ONE, two: { ...core.DEFAULT_ROOMS.two } }, refundTerms: TERMS };
  const KEY = n => `test_payment_key_${n}`;
  const stay = (checkIn, checkOut, amount, extra = {}) => ({ requestId: randomUUID(), room: 'one', checkIn, checkOut, guests: 2, guestName: '결제손님', guestPhone: '010-1234-5678', memo: '', agreed: true, agreedTerms: true, amount, termsKey: core.termsKey(TERMS), ...extra });
  const nights = async () => (await db.query('SELECT day::text FROM jshouse_nights ORDER BY day')).rows.map(r => r.day);
  const statusOf = async id => (await db.query('SELECT status FROM jshouse_bookings WHERE id=$1', [id])).rows[0].status;
  const later = minutes => { clock = new Date(clock.getTime() + minutes * 60000); };
  const A = 'pay-browser-A', B = 'pay-browser-B';

  try {
    await t.test('the deployed single-room tables upgrade in place: earlier bookings become 투룸 and each room gets its own dates', async () => {
      // 객실 구분이 없던 운영 스키마(2026-11 결제 버전)에 예약·잡힌 밤·닫은 날짜가 있는 상태에서 올린다
      await db.exec(fs.readFileSync(path.join(__dirname, 'fixtures/limen-schema-2026-11-pay.sql'), 'utf8'));
      const legacy = randomUUID();
      await db.query(`INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,check_in,check_out,guests,guest_name,guest_phone) VALUES($1,'JS-OLDONE',$2,'legacy','confirmed','2027-02-01','2027-02-03',2,'이전 예약','01011112222')`, [legacy, randomUUID()]);
      await db.query("INSERT INTO jshouse_nights(day,booking_id) VALUES('2027-02-01',$1),('2027-02-02',$1)", [legacy]);
      await db.query("INSERT INTO jshouse_days(day,closed,price,note) VALUES('2027-02-10',true,NULL,'휴무'),('2027-02-11',false,300000,'')");
      const { prepare } = require('../scripts/prepare-limen.cjs');
      await prepare({ query: text => db.exec(text) }); await prepare({ query: text => db.exec(text) });
      const { rows: [kept] } = await db.query("SELECT status,room,amount,paid_at FROM jshouse_bookings WHERE code='JS-OLDONE'");
      assert.deepEqual(kept, { status: 'confirmed', room: 'two', amount: null, paid_at: null });
      assert.deepEqual((await db.query("SELECT room,day::text FROM jshouse_nights ORDER BY day")).rows, [{ room: 'two', day: '2027-02-01' }, { room: 'two', day: '2027-02-02' }]);
      assert.deepEqual((await db.query("SELECT room,day::text,closed,price,season FROM jshouse_days ORDER BY day")).rows,
        [{ room: 'two', day: '2027-02-10', closed: true, price: null, season: '' }, { room: 'two', day: '2027-02-11', closed: false, price: 300000, season: '' }]);
      // 같은 밤이라도 다른 객실은 잡을 수 있고, 같은 객실은 두 번 잡을 수 없다
      await db.query("INSERT INTO jshouse_nights(room,day,booking_id) VALUES('one','2027-02-01',$1)", [legacy]);
      await assert.rejects(db.query("INSERT INTO jshouse_nights(room,day,booking_id) VALUES('two','2027-02-01',$1)", [legacy]), /unique|duplicate/i);
      await db.query("DELETE FROM jshouse_nights WHERE room='one'");
      await assert.rejects(db.query("UPDATE jshouse_bookings SET status='bogus' WHERE code='JS-OLDONE'"), /check/i);
      await assert.rejects(db.query("UPDATE jshouse_bookings SET room='suite' WHERE code='JS-OLDONE'"), /check/i);
      await assert.rejects(db.query("INSERT INTO jshouse_days(room,day,season) VALUES('one','2027-03-01','holiday')"), /check/i);
      const cal = await api.calendar();
      assert.ok(cal.rooms.two.closed.includes('2027-02-10')); assert.equal(cal.rooms.two.prices['2027-02-11'], 300000); assert.equal(cal.rooms.one.prices['2027-02-11'], 200000);
      assert.deepEqual(cal.rooms.two.taken, ['2027-02-01', '2027-02-02']); assert.deepEqual(cal.rooms.one.taken, []);
    });

    await t.test('card payment opens only with refund terms, live keys and the switch on', async () => {
      // 취소·환불 규정은 공정위 기준 표준 규정이 기본이라, 실결제 키와 스위치만 켜져 있으면 바로 카드 결제를 받는다
      const fresh = await api.calendar();
      assert.equal(fresh.pay, true); assert.equal(fresh.config.refundTerms, core.STANDARD_REFUND_TERMS); assert.equal(fresh.termsKey, core.termsKey(core.STANDARD_REFUND_TERMS));
      // 비워서 저장해도 표준 규정으로 돌아간다 (규정 없이 결제받는 일은 없다)
      await api.saveConfig({ ...PRICED, refundTerms: '  ' });
      assert.equal((await api.readConfig()).refundTerms, core.STANDARD_REFUND_TERMS); assert.equal((await api.calendar()).pay, true);
      await assert.rejects(api.saveConfig({ ...PRICED, payOnline: 'yes' }), /카드 결제 받기/);
      await api.saveConfig({ ...PRICED, refundTerms: '너무 짧음' });
      assert.equal((await api.calendar()).pay, false, 'terms too short to be real');
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000), A), e => e.status === 409 && /카드 결제를 받을 수 없/.test(e.message));
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
      assert.deepEqual(await nights(), ['2027-02-01', '2027-02-02'], 'refused attempts hold nothing (only the earlier 투룸 booking remains)');
      await db.query("DELETE FROM jshouse_nights WHERE room='two'");
      const req = stay('2026-11-23', '2026-11-25', 360000);
      held = await api.reserve(req, A);
      const again = await api.reserve(req, A);
      assert.equal(held.created, true); assert.equal(again.created, false); assert.equal(again.orderId, held.orderId);
      assert.equal(held.booking.status, 'pending'); assert.equal(held.payable, true); assert.equal(held.amount, 360000);
      assert.equal(held.booking.paid, false); assert.equal(held.booking.estimate.refundTerms, TERMS); assert.equal(held.booking.roomName, '원룸');
      // 같은 밤의 투룸은 따로 결제할 수 있다 (주중 35만 × 2)
      const twin = await api.reserve(stay('2026-11-23', '2026-11-25', 700000, { room: 'two', guests: 4 }), 'pay-browser-T');
      assert.equal(twin.booking.status, 'pending'); assert.equal(twin.amount, 700000);
      await api.abandon(twin.orderId, 'pay-browser-T');
      await assert.rejects(api.reserve(stay('2026-11-23', '2026-11-25', 360000, { guests: 3 }), B), /원룸은 최대 2명/);
      assert.equal(new Date(held.booking.expiresAt).getTime() - clock.getTime(), core.HOLD_MINUTES * 60000);
      assert.deepEqual(await nights(), ['2026-11-23', '2026-11-24']);
      assert.deepEqual((await api.calendar()).rooms.one.taken, ['2026-11-23', '2026-11-24']);
      await assert.rejects(api.reserve(stay('2026-11-24', '2026-11-26', 360000), B), e => e.status === 409 && /마감/.test(e.message));
      // 결제할 수 있는 일정은 결제 없이 신청으로 들어올 수 없다
      await assert.rejects(api.request(stay('2026-11-26', '2026-11-27', 180000), B), e => e.status === 409 && /카드 결제로 바로/.test(e.message));
      assert.equal((await api.status(held.orderId, A)).booking.code, held.booking.code);
      await assert.rejects(api.status(held.orderId, B), e => e.status === 404);
      assert.equal((await api.mine(A)).length, 0, 'an unpaid hold is not listed as a booking');
    });

    await t.test('an unpaid hold expires, reopens the dates, and a late approval is refused without charging', async () => {
      later(16);
      assert.deepEqual((await api.calendar()).rooms.one.taken, [], 'open again even before cleanup runs');
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
      assert.ok((await api.calendar()).rooms.one.taken.includes('2026-11-27'), 'dates under confirmation are never auto-released');
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
      const blank = { ...ONE, weekday: null, friday: null, saturday: null };
      await api.saveConfig({ ...PRICED, rooms: { one: blank, two: { ...core.DEFAULT_ROOMS.two } } });
      await api.setDays({ rooms: ['one'], start: '2027-01-11', end: '2027-01-11', price: 200000 });
      // 원룸은 1/11 만 요금이 있고 1/12 는 없음 → 결제 불가, 신청으로 접수
      await assert.rejects(api.reserve(stay('2027-01-11', '2027-01-13', 200000), 'pay-browser-D'), e => e.status === 409 && /요금이 정해지지 않은/.test(e.message));
      const requested = await api.request(stay('2027-01-11', '2027-01-13', 0), 'pay-browser-D');
      assert.equal(requested.booking.status, 'requested'); assert.equal(requested.booking.amount, null); assert.equal(requested.booking.paid, false);
      // 요금이 있는 하루만 고르면 결제로 받는다. 요금표가 그대로인 투룸은 계속 결제로 받는다.
      await api.setDays({ rooms: ['one'], start: '2027-01-18', end: '2027-01-18', price: 200000 });
      assert.equal((await api.reserve(stay('2027-01-18', '2027-01-19', 200000), 'pay-browser-D')).booking.status, 'pending');
      assert.equal((await api.reserve(stay('2027-01-11', '2027-01-13', 700000, { room: 'two' }), 'pay-browser-E')).booking.status, 'pending');
      const view = await api.admin();
      assert.equal(view.pay, true); assert.equal(view.termsReady, true);
      const row = view.bookings.find(b => b.code === paid.booking.code);
      assert.equal(row.amount, 360000); assert.equal(row.refund_amount, 180000); assert.equal(row.cancel_reason, '고객 요청'); assert.ok(row.paid_at); assert.equal(row.room, 'one');
      for (const action of ['pay_started', 'confirming', 'paid', 'pay_failed', 'pay_abandoned', 'cancelling', 'refunded', 'cancelled_without_refund']) {
        assert.ok((await db.query('SELECT 1 FROM jshouse_events WHERE action=$1 LIMIT 1', [action])).rows.length, `event ${action} recorded`);
      }
      // 직접 쓴 규정에 동의한 예약은 환불 금액을 계산해 주지 않는다 (운영자가 규정을 보고 정한다)
      assert.equal(view.bookings.some(b => b.refund), false);
      assert.equal(view.standardRefundTerms, core.STANDARD_REFUND_TERMS); assert.equal(view.holidaysUntil, '2028-12-31'); assert.equal(view.seasonGuide.length, 3);
    });

    await t.test('a booking under the standard terms carries the refund the rules give, as of the day the guest asked', async () => {
      const STANDARD = core.STANDARD_REFUND_TERMS;
      await api.saveConfig({ ...core.DEFAULT_CONFIG });
      const quoteOf = async code => (await api.admin()).bookings.find(b => b.code === code).refund;
      const pay = async (checkIn, checkOut, amount, room, browser, key) => {
        const order = await api.reserve(stay(checkIn, checkOut, amount, { room, guests: 2, termsKey: core.termsKey(STANDARD) }), browser);
        const done = await api.confirm({ orderId: order.orderId, paymentKey: KEY(key), amount });
        assert.equal(done.booking.status, 'confirmed'); assert.equal(done.booking.estimate.refundTerms, STANDARD);
        return done;
      };
      // 성수기 주말: 원룸 12/24(목 · 극성수기 · 성탄절 전날) 1박 30만원. 오늘은 11/16 이후 — 입실 10일 전보다 이르다
      const peak = await pay('2026-12-24', '2026-12-25', 300000, 'one', 'refund-browser-A', 21);
      // 비수기 주중: 투룸 12/1(화) 1박 35만원
      const low = await pay('2026-12-01', '2026-12-02', 350000, 'two', 'refund-browser-B', 22);
      assert.deepEqual(await quoteOf(peak.booking.code), { daysBefore: 38, percent: 0, fee: 0, refund: 300000, free: true, basis: '결제 후 24시간 이내 취소', asked: false });
      clock = new Date('2026-11-20T03:00:00Z'); // 결제 24시간이 지난 뒤, 입실 34일 전
      assert.deepEqual(await quoteOf(peak.booking.code), { daysBefore: 34, percent: 0, fee: 0, refund: 300000, free: false, basis: '성수기 주말 · 입실 34일 전 취소', asked: false });
      assert.deepEqual(await quoteOf(low.booking.code), { daysBefore: 11, percent: 0, fee: 0, refund: 350000, free: false, basis: '비수기 주중 · 입실 11일 전 취소', asked: false });
      // 비수기는 입실 2일 전까지 전액, 1일 전 10%, 당일 20% 공제
      for (const [at, percent, refund] of [['2026-11-29T03:00:00Z', 0, 350000], ['2026-11-30T03:00:00Z', 10, 315000], ['2026-12-01T03:00:00Z', 20, 280000], ['2026-12-02T03:00:00Z', 20, 280000]]) {
        clock = new Date(at);
        const q = await quoteOf(low.booking.code); assert.equal(q.percent, percent, at); assert.equal(q.refund, refund, at);
      }
      // 성수기 주말: 10일 전까지 전액 · 9~7일 전 20% · 6~5일 전 40% · 4~3일 전 60% · 그 뒤 90% 공제
      for (const [at, percent, refund] of [['2026-12-14T03:00:00Z', 0, 300000], ['2026-12-15T03:00:00Z', 20, 240000], ['2026-12-17T14:59:00Z', 20, 240000], ['2026-12-17T15:00:00Z', 40, 180000],
        ['2026-12-19T03:00:00Z', 40, 180000], ['2026-12-20T03:00:00Z', 60, 120000], ['2026-12-22T03:00:00Z', 90, 30000], ['2026-12-24T03:00:00Z', 90, 30000]]) {
        clock = new Date(at);
        const q = await quoteOf(peak.booking.code); assert.equal(q.percent, percent, at); assert.equal(q.refund, refund, at);
      }
      // 손님이 12/18(입실 6일 전)에 취소를 요청하면, 운영자가 며칠 뒤에 처리해도 요청한 날 기준이다
      clock = new Date('2026-12-18T03:00:00Z');
      await api.guestCancel({ code: peak.booking.code, phone: '01012345678' }, 'refund-browser-A');
      clock = new Date('2026-12-22T03:00:00Z');
      const asked = await quoteOf(peak.booking.code);
      assert.deepEqual(asked, { daysBefore: 6, percent: 40, fee: 120000, refund: 180000, free: false, basis: '성수기 주말 · 입실 6일 전 취소', asked: true });
      const cancelled = await api.refund({ id: peak.orderId, amount: asked.refund, reason: '고객 요청 취소' });
      assert.equal(cancelled.booking.status, 'cancelled'); assert.equal(cancelled.booking.refundAmount, 180000);
      assert.equal((await api.admin()).bookings.find(b => b.code === peak.booking.code).refund, undefined, 'no quote once the booking is cancelled');
    });
  } finally {
    await db.close();
  }
});
