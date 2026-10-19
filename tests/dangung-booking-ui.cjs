const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { load } = require('./support/load.cjs');

function fixture({ selling = true } = {}) {
  let cursor = 0;
  const values = [];
  const hookReact = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
  };
  const calendar = {
    today: '2026-10-17', version: 8, paymentReady: selling,
    config: { enabled: true, minLeadDays: 1, maxNights: 7, extraGuestFee: 20000, extraGuestUnit: 'perStay', bbqFee: 50000, monitorFee: 50000 },
    dates: [18, 19, 20, 21, 22].map(day => ({ day: `2026-10-${day}`, price: 300000, season: '일반', available: true, occupied: day === 20 })),
  };
  const Calendar = () => null, Summary = () => null;
  const { startingPrice } = load('components/dangung/Availability.tsx');
  const View = load('components/dangung/Booking.tsx', {
    react: hookReact,
    './Calendar': Calendar,
    './PaymentSummary': Summary,
    './Availability': { startingPrice, useDangungAvailability: () => ({ calendar, loadError: '', refresh: async () => calendar }) },
    '@/lib/use-meta-event': { useMetaEvent() {} },
    '@tosspayments/tosspayments-sdk': { loadTossPayments() { throw Error('Real payment blocked in UI tests'); } },
  }).default;
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const text = node => node == null ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : React.Children.toArray(node.props?.children).map(text).join('');
  const render = () => {
    cursor = 0;
    const tree = View({ clientKey: 'test-only' });
    for (const node of nodes(tree).filter(node => node.type === 'dialog')) {
      node.props.ref.current ??= { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
    }
    return tree;
  };
  const getCalendar = tree => nodes(tree).find(node => node.type === Calendar);
  const form = tree => nodes(tree).find(node => node.type === 'form' && node.props.className.includes('dgs-booking-form'));
  const summary = tree => nodes(tree).find(node => node.type === Summary);
  return { render, nodes, text, getCalendar, form, summary, calendar };
}

test('compact booking asks for dates in a dialog and does not request a quote before selection', async () => {
  const f = fixture(), original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw Error('No quote without dates'); };
  try {
    let tree = f.render();
    const trigger = f.nodes(tree).find(node => node.props?.['aria-controls'] === 'dangung-date-picker');
    assert.equal(trigger.props['aria-haspopup'], 'dialog');
    await f.form(tree).props.onSubmit({ preventDefault() {} });
    tree = f.render();
    const dialog = f.nodes(tree).find(node => node.props?.id === 'dangung-date-picker');
    assert.equal(dialog.props.ref.current.open, true);
    assert.match(f.text(tree), /입실일과 퇴실일을 선택해 주세요/);
    assert.equal(calls, 0);
  } finally { global.fetch = original; }
});

test('calendar permits checkout on an occupied night but rejects stays crossing it', () => {
  const f = fixture();
  f.getCalendar(f.render()).props.onChoose('2026-10-18');
  let calendar = f.getCalendar(f.render());
  assert.equal(calendar.props.available('2026-10-20'), false);
  assert.equal(calendar.props.canOut('2026-10-20'), true);
  assert.equal(calendar.props.canOut('2026-10-21'), false);
  calendar.props.onChoose('2026-10-21');
  let tree = f.render();
  assert.equal(f.getCalendar(tree).props.checkOut, '');
  assert.match(f.text(tree), /기간 중 마감된 날짜/);
  f.getCalendar(tree).props.onChoose('2026-10-20');
  tree = f.render();
  assert.equal(f.getCalendar(tree).props.checkOut, '2026-10-20');
  assert.match(f.text(tree), /2박 3일/);
});

test('sidebar quote uses the selected dates and changing an option invalidates the previous quote', async () => {
  const f = fixture(), original = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/dangung');
    const input = JSON.parse(options.body); requests.push(input);
    return Response.json({ ...input, version: 8, nightly: [{ day: input.checkIn, price: 300000, season: '일반' }], lodging: 300000, extra: 0, bbq: input.bbq ? 50000 : 0, monitor: 0, total: input.bbq ? 350000 : 300000, depositAmount: 100000, refundTerms: '서버 환불규정', depositTerms: '서버 보증금 규정', depositPaymentNote: '별도 납부' });
  };
  try {
    f.getCalendar(f.render()).props.onChoose('2026-10-18');
    f.getCalendar(f.render()).props.onChoose('2026-10-19');
    await f.form(f.render()).props.onSubmit({ preventDefault() {} });
    let tree = f.render();
    assert.equal(f.summary(tree).props.quote.total, 300000);
    assert.deepEqual(requests[0], { action: 'quote', checkIn: '2026-10-18', checkOut: '2026-10-19', guests: 6, infants: 0, bbq: false, monitor: false });
    const bbq = f.nodes(tree).find(node => node.type === 'label' && f.text(node).includes('바비큐 세팅'));
    f.nodes(bbq).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
    tree = f.render();
    assert.equal(f.summary(tree), undefined);
    await f.form(tree).props.onSubmit({ preventDefault() {} });
    tree = f.render();
    assert.equal(f.summary(tree).props.quote.total, 350000);
    const terms = f.nodes(tree).find(node => node.type === 'button' && f.text(node) === '환불규정 확인하고 예약하기');
    terms.props.onClick();
    tree = f.render();
    assert.match(f.text(tree), /서버 환불규정/);
    assert.match(f.text(tree), /서버 보증금 규정/);
    const continueButton = f.nodes(tree).find(node => node.type === 'button' && f.text(node) === '결제 진행 →');
    assert.equal(continueButton.props.disabled, true);
    f.getCalendar(tree).props.onReset();
    tree = f.render();
    assert.equal(f.summary(tree), undefined);
    assert.equal(f.getCalendar(tree).props.checkIn, '');
    assert.equal(f.getCalendar(tree).props.checkOut, '');
  } finally { global.fetch = original; }
});

test('payment-not-ready state disables reservation fields and date choices', () => {
  const f = fixture({ selling: false }), tree = f.render();
  const fields = f.nodes(f.form(tree)).find(node => node.type === 'fieldset');
  assert.equal(fields.props.disabled, true);
  assert.equal(f.getCalendar(tree).props.available('2026-10-18'), false);
  assert.match(f.text(tree), /예약 오픈 준비 중/);
});
