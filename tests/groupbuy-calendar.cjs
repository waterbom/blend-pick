const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./support/load.cjs');
const {
  kstDayKey, saleCalendarRange, saleCalendarStatus, isScheduledSaleDay,
  initialCalendarDay, calendarMonthFor, shiftCalendarMonth, calendarMonthDays, formatKstScheduleTime,
} = load('lib/groupbuy-calendar.ts');
const ms = value => Date.parse(value);

test('KST calendar dates and displayed times cross UTC month/year boundaries correctly', () => {
  const boundary = ms('2026-12-31T15:00:00Z');
  assert.equal(kstDayKey(boundary - 1), '2026-12-31');
  assert.equal(kstDayKey(boundary), '2027-01-01');
  assert.equal(formatKstScheduleTime(boundary), '2027.01.01 00:00');
  assert.deepEqual(calendarMonthFor(kstDayKey(boundary)), { year: 2027, month: 1 });
  const range = saleCalendarRange(ms('2026-09-30T15:00:00Z'), ms('2026-10-02T14:59:59Z'));
  assert.equal(range.startDay, '2026-10-01');
  assert.equal(range.endDay, '2026-10-02');
  assert.equal(isScheduledSaleDay('2026-09-30', range), false);
  assert.equal(isScheduledSaleDay('2026-10-01', range), true);
  assert.equal(isScheduledSaleDay('2026-10-02', range), true);
  assert.equal(isScheduledSaleDay('2026-10-03', range), false);
});

test('sale status changes at the exact opening time and after the inclusive closing instant', () => {
  const start = ms('2026-10-06T09:00:00+09:00');
  const end = ms('2026-10-08T00:00:00+09:00');
  const range = saleCalendarRange(start, end);
  assert.equal(saleCalendarStatus(range, start - 1), 'upcoming');
  assert.equal(saleCalendarStatus(range, start), 'open');
  assert.equal(saleCalendarStatus(range, end), 'open');
  assert.equal(saleCalendarStatus(range, end + 1), 'ended');
  assert.equal(isScheduledSaleDay('2026-10-08', range), true);
  assert.equal(initialCalendarDay(range, start - 86400000), '2026-10-06');
  assert.equal(initialCalendarDay(range, ms('2026-10-07T12:00:00+09:00')), '2026-10-07');
  assert.equal(initialCalendarDay(range, end + 86400000), '2026-10-08');
});

test('month navigation handles year changes and February leap days without local timezone arithmetic', () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftCalendarMonth({ year: 2027, month: 1 }, -1), { year: 2026, month: 12 });
  assert.deepEqual(shiftCalendarMonth({ year: 2027, month: 1 }, 14), { year: 2028, month: 3 });
  const leap = calendarMonthDays({ year: 2028, month: 2 });
  const regular = calendarMonthDays({ year: 2027, month: 2 });
  assert.equal(leap.filter(day => day.inMonth).length, 29);
  assert.equal(regular.filter(day => day.inMonth).length, 28);
  assert.equal(leap[0].weekday, 0);
  assert.equal(leap.at(-1).weekday, 6);
  assert.ok(leap.some(day => day.key === '2028-02-29' && day.inMonth));
  assert.equal(new Set(leap.map(day => day.key)).size, leap.length);
});

test('missing dates do not invent a sale period and a single endpoint remains visible', () => {
  const now = ms('2026-10-06T12:00:00+09:00');
  const empty = saleCalendarRange(null, null);
  assert.equal(saleCalendarStatus(empty, now), 'unscheduled');
  assert.equal(isScheduledSaleDay('2026-10-06', empty), false);
  assert.equal(initialCalendarDay(empty, now), '2026-10-06');
  const startOnly = saleCalendarRange(now, null);
  const endOnly = saleCalendarRange(null, now);
  assert.equal(saleCalendarStatus(startOnly, now - 1), 'upcoming');
  assert.equal(saleCalendarStatus(startOnly, now + 1), 'open');
  assert.equal(saleCalendarStatus(endOnly, now + 1), 'ended');
  assert.equal(isScheduledSaleDay('2026-10-06', startOnly), true);
  assert.equal(isScheduledSaleDay('2026-10-06', endOnly), true);
  assert.equal(isScheduledSaleDay('2026-10-07', startOnly), false);
  assert.equal(isScheduledSaleDay('2026-10-05', endOnly), false);
});

test('invalid or reversed schedules never highlight dates or throw ISO range errors', () => {
  const now = ms('2026-10-06T12:00:00+09:00');
  for (const range of [saleCalendarRange(NaN, null), saleCalendarRange(null, Infinity), saleCalendarRange(1e20, null), saleCalendarRange(now + 1, now)]) {
    assert.equal(range.valid, false);
    assert.equal(saleCalendarStatus(range, now), 'invalid');
    assert.equal(isScheduledSaleDay('2026-10-06', range), false);
    assert.equal(initialCalendarDay(range, now), '2026-10-06');
  }
});

test('manual close overrides an ongoing calendar badge without changing registered dates or today', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Calendar = load('components/blend/GroupbuyCalendar.tsx', {'./GroupbuyCalendar.module.css':{today:'today',saleDay:'sale-day'}}).default;
  const props = {saleStartMs:ms('2026-10-01T00:00:00+09:00'),saleEndMs:ms('2026-10-09T23:59:00+09:00'),nowMs:ms('2026-10-06T12:00:00+09:00')};
  const open = renderToStaticMarkup(React.createElement(Calendar, props));
  const closed = renderToStaticMarkup(React.createElement(Calendar, {...props,ended:true}));
  assert.match(open,/data-state="open">공구 진행 중/);
  assert.match(closed,/data-state="ended">공구 마감/);
  assert.doesNotMatch(closed,/공구 진행 중|<button/);
  assert.deepEqual(closed.match(/<time\b[^>]*>[\s\S]*?<\/time>/g),open.match(/<time\b[^>]*>[\s\S]*?<\/time>/g));
  assert.equal((closed.match(/aria-current="date"/g)||[]).length,1);
  assert.match(closed,/dateTime="2026-10-06" class="sale-day today"/);
});
