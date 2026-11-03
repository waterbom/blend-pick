const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./support/load.cjs');
const { closingCountdown } = load('lib/closing-countdown.ts');
const Countdown = load('components/sanji/SanjiClosingCountdown.tsx').default;
const now = Date.parse('2026-11-03T00:00:00Z');
const endAfter = milliseconds => new Date(now + milliseconds).toISOString();
const hour = 3600000;

test('countdown uses the real deadline and separates days from the running clock', () => {
  const result = closingCountdown(endAfter(38 * hour + 4 * 60000 + 12000), now);
  assert.deepEqual([result.days, result.hours, result.minutes, result.seconds], [1, 14, 4, 12]);
  assert.equal(result.label, '마감까지 1일 14시간 4분 12초 남음');
});

test('urgency changes only at the actual 24 and 48 hour boundaries', () => {
  for (const [left, level] of [[24 * hour, 'urgent'], [24 * hour + 1, 'soon'], [48 * hour, 'soon'], [48 * hour + 1, 'scheduled'], [7 * 24 * hour, 'scheduled']]) {
    assert.equal(closingCountdown(endAfter(left), now).urgency, level, left);
  }
});

test('the last partial second remains visible and an expired deal has no running countdown', () => {
  assert.equal(closingCountdown(endAfter(1), now).seconds, 1);
  assert.equal(closingCountdown(endAfter(1000), now).seconds, 1);
  assert.equal(closingCountdown(endAfter(1001), now).seconds, 2);
  assert.equal(closingCountdown(endAfter(0), now), null);
  assert.equal(closingCountdown(endAfter(-1), now), null);
});

test('equivalent timezone offsets share one countdown and invalid input shows no urgency', () => {
  assert.deepEqual(closingCountdown('2026-11-04T00:00:00Z', now), closingCountdown('2026-11-04T09:00:00+09:00', now));
  for (const end of ['', 'invalid', '2026-99-99']) assert.equal(closingCountdown(end, now), null);
  for (const time of [NaN, Infinity, -Infinity]) assert.equal(closingCountdown(endAfter(hour), time), null);
});

test('running timer is readable without announcing every second to screen readers', () => {
  const html = renderToStaticMarkup(React.createElement(Countdown, { end: endAfter(4 * 60000 + 12000), now }));
  assert.match(html, /role="timer"/);
  assert.match(html, /aria-live="off"/);
  assert.match(html, /aria-label="마감까지 0시간 4분 12초 남음"/);
  assert.match(html, /<b>00<\/b>/);
  assert.match(html, /<b>04<\/b>/);
  assert.match(html, /<b>12<\/b>/);
  assert.equal(renderToStaticMarkup(React.createElement(Countdown, { end: endAfter(-1), now })), '');
});
