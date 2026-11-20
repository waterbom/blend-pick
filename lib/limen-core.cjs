// LIMEN(리멘 · 연남동) 예약 원장.
//
// 객실은 두 가지(원룸 2인 · 투룸 4인)이고 서로 다른 공간이라 날짜를 따로 잡는다. 같은 객실의 같은 밤은 한 팀만 예약할 수 있다.
// 요금은 숙소가 보낸 요금표를 따른다: 주중(일–목) · 금요일 · 토요일 · 준성수기 · 극성수기.
// 어느 날이 준성수기·극성수기인지는 시즌 달력(lib/limen-policy.cjs)이 정하고, 운영자가 블럭표에서 날짜별로 바꿀 수 있다.
//
// 예약 방식은 두 가지이고, 서버가 일정마다 정한다.
//  1) 카드 결제 (블랜드픽·단궁과 같은 토스 결제 과정)
//     요금이 모두 정해진 일정 + 취소·환불 규정(기본: 공정위 기준 표준 규정) + 실결제 키 준비 → 날짜를 15분 잡고(pending) 결제창을 연다
//     → 서버가 승인(confirming) → 예약 확정(confirmed, 결제 정보 저장) → 관리자가 환불 금액을 정해 취소(cancelling → cancelled).
//     표준 규정에 동의한 예약은 관리자 화면에 규정대로 계산한 환불 금액을 함께 보여 준다.
//     결제창에서 돌아오지 않으면 15분 뒤 자동으로 날짜가 다시 열린다(expired). 승인 확인 중인 날짜는 자동으로 풀지 않는다.
//  2) 예약 신청 (요금이 없는 날짜이거나 카드 결제를 꺼 둔 경우)
//     신청 즉시 날짜 점유(requested) → 운영자가 확정/거절 → 거절·취소되면 날짜가 다시 열린다.
//
// 테이블 이름의 jshouse 는 브랜드명이 LIMEN으로 확정되기 전의 작업명이다. 운영 데이터를 그대로 두려고 바꾸지 않았다.
// 단궁(dangung-core.cjs)의 결제 원장과는 테이블·코드 모두 분리되어 있다.
const { randomUUID, randomInt, createHash } = require('node:crypto');
const {
  DAY, today, addDays, weekdayOf, autoSeason, isWeekendNight, SEASON_GUIDE, HOLIDAYS_UNTIL, STANDARD_REFUND_TERMS, refundQuote,
} = require('./limen-policy.cjs');

class StayError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new StayError(message, status); };
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = d => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

// 객실 — 숙소가 보낸 요금 안내(2026-11) 그대로. 기준 인원 = 최대 인원이고 인원 추가는 받지 않는다.
// 요금 칸을 비우면(null) 그 날짜는 요금 없이 예약 신청으로만 받는다.
const ROOM_KEYS = ['one', 'two'];
const ROOM_NAMES = { one: '원룸', two: '투룸' };
const RATE_KEYS = ['weekday', 'friday', 'saturday', 'shoulder', 'peak']; // 일–목 · 금 · 토 · 준성수기 · 극성수기
const RATE_NAMES = { weekday: '주중(일–목)', friday: '금요일', saturday: '토요일', shoulder: '준성수기', peak: '극성수기' };
// 날짜에 지정하는 시즌: '' = 시즌 달력을 따름 · normal = 평시로 고정 · shoulder 준성수기 · peak 극성수기
const SEASONS = ['', 'normal', 'shoulder', 'peak'];
const DEFAULT_ROOMS = Object.freeze({
  one: Object.freeze({ open: true, guests: 2, weekday: 200000, friday: 230000, saturday: 250000, shoulder: 270000, peak: 300000 }),
  two: Object.freeze({ open: true, guests: 4, weekday: 350000, friday: 380000, saturday: 400000, shoulder: 420000, peak: 450000 }),
});

const DEFAULT_CONFIG = Object.freeze({
  open: true,          // 예약 받기 (전체)
  minLeadDays: 1,      // 오늘로부터 며칠 뒤 입실부터 받을지 (0 = 당일)
  maxNights: 14,       // 한 번에 신청할 수 있는 최대 숙박일
  windowDays: 180,     // 오늘로부터 며칠 뒤까지 달력을 열지
  rooms: DEFAULT_ROOMS, // 객실별 예약 받기 여부 · 최대 인원 · 요금표
  checkInTime: '',     // "15:00" 형식. 비우면 "예약 확정 시 안내"
  checkOutTime: '',
  address: '',         // 공개 주소. 비우면 "예약 확정 후 안내"
  walkNote: '',        // 예: "홍대입구역 3번 출구에서 걸어서 8분"
  parkingNote: '',     // 예: "주차 불가 · 인근 공영주차장 이용"
  mapUrl: '',          // 지도 링크 (https)
  notice: '',          // 예약 영역 상단 한 줄 공지
  rules: '',           // 이용 안내 (한 줄에 하나)
  notifyPhone: '',     // 새 신청 알림을 받을 운영자 휴대폰 (공개 안 됨)
  autoSeasons: true,   // 성수기·공휴일 자동 적용 — 시즌 달력대로 준성수기·극성수기·공휴일 전날 요금을 받는다
  payOnline: true,     // 카드 결제 받기 — 요금·환불 규정·결제 키가 모두 준비된 일정에만 적용된다
  // 취소·환불 규정. 결제 전에 손님이 동의하고, 동의한 내용이 예약에 함께 저장된다. 비워 두면 표준 규정으로 돌아간다.
  refundTerms: STANDARD_REFUND_TERMS,
});
const HOLD_MINUTES = 15;      // 결제창을 여는 동안 날짜를 잡아 두는 시간
const MIN_TERMS_LENGTH = 20;  // 이보다 짧은 환불 규정으로는 카드 결제를 열지 않는다
const PRIVATE_KEYS = ['notifyPhone'];

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString().slice(0, 10) !== value) fail('올바른 날짜를 선택해 주세요.');
  return value;
}
// 숙박하는 밤 목록 — 퇴실일은 포함하지 않는다
function nightsOf(checkIn, checkOut, max = 366) {
  date(checkIn); date(checkOut);
  const n = (Date.parse(checkOut) - Date.parse(checkIn)) / DAY;
  if (n < 1 || n > max) fail('숙박 기간을 확인해 주세요.');
  return Array.from({ length: n }, (_, i) => addDays(checkIn, i));
}
function integer(v, min, max, name) {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail(`${name} 값을 확인해 주세요.`);
  return v;
}
const text = (v, max, name) => {
  if (typeof v !== 'string' || v.length > max) fail(`${name} 내용을 확인해 주세요.`);
  return v.trim();
};
const isPhone = v => typeof v === 'string' && /^01[016789]\d{7,8}$/.test(v);

function mergeConfig(stored) {
  const merged = { ...DEFAULT_CONFIG };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULT_CONFIG)) if (key !== 'rooms' && stored[key] !== undefined) merged[key] = stored[key];
  }
  // 객실 설정은 항목별로 합친다 — 저장된 값이 없는 칸은 요금표 기본값
  const rooms = stored && typeof stored === 'object' && stored.rooms && typeof stored.rooms === 'object' ? stored.rooms : {};
  merged.rooms = Object.fromEntries(ROOM_KEYS.map(key => {
    const room = { ...DEFAULT_ROOMS[key] }, saved = rooms[key] && typeof rooms[key] === 'object' ? rooms[key] : {};
    for (const field of Object.keys(room)) if (saved[field] !== undefined) room[field] = saved[field];
    return [key, room];
  }));
  // 환불 규정을 비워 둔 채로는 운영하지 않는다 — 표준 규정이 기본이다 (카드 결제를 끄려면 payOnline)
  if (typeof merged.refundTerms !== 'string' || !merged.refundTerms.trim()) merged.refundTerms = STANDARD_REFUND_TERMS;
  return merged;
}
function validateConfig(input) {
  const c = mergeConfig(input);
  if (typeof c.open !== 'boolean') fail('예약 신청 받기 여부를 확인해 주세요.');
  integer(c.minLeadDays, 0, 60, '예약 준비일');
  integer(c.maxNights, 1, 30, '최대 숙박일');
  integer(c.windowDays, 14, 365, '달력 공개 기간');
  for (const key of ROOM_KEYS) {
    const room = c.rooms[key], label = ROOM_NAMES[key];
    if (typeof room.open !== 'boolean') fail(`${label} 예약 받기 여부를 확인해 주세요.`);
    integer(room.guests, 1, 20, `${label} 최대 인원`);
    for (const rate of RATE_KEYS) if (room[rate] !== null) integer(room[rate], 1, 10000000, `${label} ${RATE_NAMES[rate]} 요금`);
  }
  for (const [key, name] of [['checkInTime', '체크인 시간'], ['checkOutTime', '체크아웃 시간']]) {
    if (typeof c[key] !== 'string' || (c[key] !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key]))) fail(`${name}은 15:00 형식으로 입력해 주세요.`);
  }
  c.address = text(c.address, 120, '주소');
  c.walkNote = text(c.walkNote, 80, '오시는 길 한 줄');
  c.parkingNote = text(c.parkingNote, 80, '주차 안내');
  c.notice = text(c.notice, 200, '공지');
  c.rules = text(c.rules, 2000, '이용 안내');
  c.mapUrl = text(c.mapUrl, 300, '지도 링크');
  if (c.mapUrl && !/^https:\/\/[^\s]+$/.test(c.mapUrl)) fail('지도 링크는 https:// 로 시작하는 주소를 넣어 주세요.');
  if (typeof c.notifyPhone !== 'string') fail('알림 받을 휴대폰 번호를 확인해 주세요.');
  c.notifyPhone = c.notifyPhone.replace(/[^0-9]/g, '');
  if (c.notifyPhone && !isPhone(c.notifyPhone)) fail('알림 받을 휴대폰 번호를 확인해 주세요.');
  if (typeof c.autoSeasons !== 'boolean') fail('성수기 자동 적용 여부를 확인해 주세요.');
  if (typeof c.payOnline !== 'boolean') fail('카드 결제 받기 여부를 확인해 주세요.');
  c.refundTerms = text(c.refundTerms, 4000, '취소·환불 규정');
  return c;
}
function publicConfig(config) {
  const out = { ...config };
  for (const key of PRIVATE_KEYS) delete out[key];
  return out;
}

const isRoom = value => typeof value === 'string' && ROOM_KEYS.includes(value);
/**
 * 그 밤의 요금과 구분. 요금은 날짜에 직접 넣은 요금 → 운영자가 지정한 시즌 → 시즌 달력 → 요일(금·토·주중) 순서로 정한다.
 * @param {string} day @param {any} rates 객실 요금표 @param {{price?:number|null, season?:string}} [row] 날짜별 설정
 * @param {boolean} [auto] 시즌 달력을 쓸지 (설정의 autoSeasons)
 * @returns {{day:string, price:number|null, rate:string, season:''|'shoulder'|'peak', weekend:boolean, manual:boolean}}
 *   rate: 적용된 요금 칸(custom = 날짜에 넣은 요금) · season/weekend: 환불 기준의 성수기·주말 구분 · manual: 운영자가 시즌을 지정한 날
 */
function nightOf(day, rates, row = {}, auto = true) {
  const manual = row.season || '';
  const kind = manual || (auto ? autoSeason(day) : ''); // normal | shoulder | peak | holiday(공휴일 전날) | ''
  const season = kind === 'peak' || kind === 'shoulder' ? kind : '';
  const weekday = weekdayOf(day);
  const column = season || (weekday === 6 || kind === 'holiday' ? 'saturday' : weekday === 5 ? 'friday' : 'weekday');
  const custom = row.price !== undefined && row.price !== null;
  return { day, price: custom ? row.price : rates[column] ?? null, rate: custom ? 'custom' : column, season, weekend: isWeekendNight(day), manual: !!manual };
}
/** @param {string} day @param {string} [season] 날짜에 지정한 시즌 @param {boolean} [auto] */
const rateOf = (day, season = '', auto = true) => nightOf(day, {}, { season }, auto).rate;
/** @param {string} day @param {any} rates @param {{price?:number|null, season?:string}} [row] @param {boolean} [auto] */
const priceOf = (day, rates, row = {}, auto = true) => nightOf(day, rates, row, auto).price;
// 예상 금액 — 요금이 없는 밤이 하나라도 있으면 합계를 내지 않는다. 밤마다 성수기·주말 구분을 함께 남긴다 (환불 계산의 근거).
function estimate(rates, dayRows, nights, auto = true) {
  const nightly = nights.map(day => { const { manual, ...night } = nightOf(day, rates, dayRows[day], auto); return night; });
  const total = nightly.every(n => n.price !== null) ? nightly.reduce((s, n) => s + n.price, 0) : null;
  return { nightly, total };
}
// 표준 규정에 동의한 결제 예약의 환불 금액 (입실일의 성수기·주말 구분은 결제할 때 남긴 값을 쓴다). 다른 규정이면 계산하지 않는다.
function refundFor(row, at) {
  if (!row.paid_at || row.amount === null || row.estimate?.refundTerms !== STANDARD_REFUND_TERMS) return null;
  const first = row.estimate?.nightly?.[0] || {};
  return refundQuote({ amount: row.amount, checkIn: iso(row.check_in), high: !!first.season, weekend: first.weekend === true, paidAt: row.paid_at }, at);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0·O·1·I 제외
// 예약번호는 LM-XXXXXX. 브랜드명 확정 전에 발급한 JS-XXXXXX 번호도 계속 조회된다.
const CODE = /^(?:LM|JS)-[A-Z2-9]{6}$/;
const newCode = () => 'LM-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const cleanCode = value => (typeof value === 'string' ? value.trim().toUpperCase().replace(/^(LM|JS)(?=[A-Z2-9]{6}$)/, '$1-') : '');
const cleanPhone = value => (typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '');

// 손님이 동의한 환불 규정이 그 사이 바뀌지 않았는지 확인하는 짧은 지문
const termsKey = terms => hash(String(terms || '')).slice(0, 16);
const termsReady = config => typeof config.refundTerms === 'string' && config.refundTerms.trim().length >= MIN_TERMS_LENGTH;

const publicBooking = r => ({
  code: r.code, status: r.status, room: r.room, roomName: ROOM_NAMES[r.room] || '',
  checkIn: iso(r.check_in), checkOut: iso(r.check_out),
  nights: Math.round((Date.parse(iso(r.check_out)) - Date.parse(iso(r.check_in))) / DAY),
  guests: r.guests, guestName: r.guest_name,
  estimate: r.estimate || {}, cancelRequested: r.cancel_requested,
  createdAt: new Date(r.created_at).toISOString(),
  // 카드 결제 예약일 때만 값이 있다
  paid: !!r.paid_at, amount: r.amount ?? null, refundAmount: r.refund_amount ?? null,
  receiptUrl: r.receipt_url || null, expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
});

/**
 * @param {any} pool
 * @param {{now?:()=>Date, provider?:any, payReady?:()=>boolean}} [options]
 *   provider: 결제 대행사 연동 {confirm, lookup, cancel}. 없으면 카드 결제는 항상 꺼진 상태다.
 */
function service(pool, { now = () => new Date(), provider = null, payReady = () => !!provider } = {}) {
  // 카드 결제를 받을 수 있는 상태인지 (일정별 요금 유무는 따로 확인)
  const payMode = config => !!provider && config.payOnline === true && termsReady(config) && payReady() === true;
  // 설정 행을 잠가 예약 신청·관리자 변경을 한 줄로 세운다
  async function tx(fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const { rows: [s] } = await c.query('SELECT * FROM jshouse_settings WHERE id=1 FOR UPDATE');
      if (!s) fail('예약 설정을 준비 중입니다.', 503);
      const result = await fn(c, mergeConfig(s.config));
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  // 기록 시각은 예약과 같은 시계(now)로 남긴다 — 취소 요청 시각이 환불 금액 계산의 기준이 된다
  const log = (c, action, bookingId, detail = {}) =>
    c.query('INSERT INTO jshouse_events(booking_id,action,detail,created_at) VALUES($1,$2,$3,$4)', [bookingId, action, JSON.stringify(detail), now()]);

  async function readConfig() {
    const { rows: [s] } = await pool.query('SELECT config FROM jshouse_settings WHERE id=1');
    if (!s) fail('예약 설정을 준비 중입니다.', 503);
    return mergeConfig(s.config);
  }

  // 날짜별 설정을 객실 → 날짜 → {closed, price, season} 으로 묶는다
  const byRoom = rows => {
    const map = Object.fromEntries(ROOM_KEYS.map(key => [key, {}]));
    for (const row of rows) if (map[row.room]) map[row.room][iso(row.day)] = row;
    return map;
  };
  // 공개 달력 — 객실마다 닫힌 날·이미 잡힌 밤·그날의 1박 요금(시즌 반영)을 내려준다. 화면은 요금을 따로 계산하지 않는다.
  async function calendar() {
    const config = await readConfig(), start = today(now()), end = addDays(start, config.windowDays);
    const [{ rows: days }, { rows: taken }] = await Promise.all([
      pool.query('SELECT room,day,closed,price,season FROM jshouse_days WHERE day>=$1 AND day<=$2 ORDER BY day', [start, end]),
      // 결제 시간이 지난 대기 예약의 날짜는 정리 전이라도 열린 것으로 본다
      pool.query(`SELECT n.room,n.day FROM jshouse_nights n JOIN jshouse_bookings b ON b.id=n.booking_id
        WHERE n.day>=$1 AND n.day<=$2 AND (b.status<>'pending' OR b.expires_at>$3) ORDER BY n.day`, [start, end, now()]),
    ]);
    const settings = byRoom(days), span = Array.from({ length: config.windowDays + 1 }, (_, i) => addDays(start, i));
    return {
      today: start, lastDay: end, config: publicConfig(config),
      pay: payMode(config), termsKey: termsKey(config.refundTerms),
      rooms: Object.fromEntries(ROOM_KEYS.map(key => {
        const nights = span.map(day => nightOf(day, config.rooms[key], settings[key][day], config.autoSeasons));
        return [key, {
          closed: days.filter(d => d.room === key && d.closed).map(d => iso(d.day)),
          taken: taken.filter(d => d.room === key).map(d => iso(d.day)),
          prices: Object.fromEntries(nights.map(n => [n.day, n.price])),
          seasons: Object.fromEntries(nights.filter(n => n.season).map(n => [n.day, n.season])),
        }];
      })),
    };
  }

  function checkStay(config, input) {
    if (!isRoom(input.room)) fail('객실을 선택해 주세요.');
    const room = config.rooms[input.room];
    if (!room.open) fail(`지금은 ${ROOM_NAMES[input.room]} 예약을 받지 않고 있어요.`, 409);
    const nights = nightsOf(input.checkIn, input.checkOut, config.maxNights);
    const start = today(now());
    if (input.checkIn < addDays(start, config.minLeadDays) || input.checkOut > addDays(start, config.windowDays)) fail('예약 가능한 날짜를 선택해 주세요.');
    // 기준 인원을 넘는 입실은 받지 않는다
    if (!Number.isSafeInteger(input.guests) || input.guests < 1 || input.guests > room.guests) fail(`${ROOM_NAMES[input.room]}은 최대 ${room.guests}명까지 머물 수 있어요. 인원을 확인해 주세요.`);
    return nights;
  }

  // 결제 시간이 지난 대기 예약을 정리하고 날짜를 돌려준다 (쓰기 작업을 시작할 때마다 실행)
  async function expire(c) {
    await c.query("DELETE FROM jshouse_nights WHERE booking_id IN (SELECT id FROM jshouse_bookings WHERE status='pending' AND expires_at<=$1)", [now()]);
    await c.query("UPDATE jshouse_bookings SET status='expired',updated_at=$1 WHERE status='pending' AND expires_at<=$1", [now()]);
  }
  function guestOf(input) {
    const name = typeof input.guestName === 'string' ? input.guestName.trim() : '';
    const phone = cleanPhone(input.guestPhone), memo = typeof input.memo === 'string' ? input.memo.trim() : null;
    if (name.length < 2 || name.length > 40 || !isPhone(phone) || memo === null || memo.length > 300) fail('예약자 이름·휴대폰 번호·요청사항을 확인해 주세요.');
    if (input.agreed !== true) fail('개인정보 수집·이용에 동의해 주세요.');
    return { name, phone, memo };
  }
  const sameStay = (row, input, phone) =>
    row.room === input.room && iso(row.check_in) === input.checkIn && iso(row.check_out) === input.checkOut && row.guests === input.guests && row.guest_phone === phone;
  // 그 객실의 닫힌 날짜·이미 잡힌 날짜가 없는지 확인하고 일정의 요금을 계산한다
  async function quoteFor(c, config, input, nights) {
    const { rows: days } = await c.query('SELECT room,day,closed,price,season FROM jshouse_days WHERE room=$1 AND day>=$2 AND day<$3', [input.room, input.checkIn, input.checkOut]);
    const { rows: taken } = await c.query('SELECT day FROM jshouse_nights WHERE room=$1 AND day>=$2 AND day<$3', [input.room, input.checkIn, input.checkOut]);
    if (taken.length || days.some(d => d.closed)) fail('선택한 기간에 이미 마감된 날짜가 있어요. 다른 날짜를 골라 주세요.', 409);
    return estimate(config.rooms[input.room], byRoom(days)[input.room], nights, config.autoSeasons);
  }
  // 그 객실의 밤을 이 예약 앞으로 잡는다 (객실·날짜 유일 제약이 동시 예약을 막는다)
  async function hold(c, room, nights, id) {
    for (const day of nights) await c.query('INSERT INTO jshouse_nights(room,day,booking_id) VALUES($1,$2,$3)', [room, day, id]);
  }
  async function freshCode(c) {
    let code = newCode();
    for (let i = 0; i < 5; i++) {
      const { rows: [dup] } = await c.query('SELECT 1 FROM jshouse_bookings WHERE code=$1', [code]);
      if (!dup) break;
      code = newCode();
    }
    return code;
  }

  // 예약 신청 (결제 없이 접수 → 운영자 확정). 카드 결제가 가능한 일정은 받지 않는다.
  async function request(input, owner) {
    return tx(async (c, config) => {
      await expire(c);
      if (!config.open) fail('지금은 예약 신청을 받지 않고 있어요.', 409);
      if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)) fail('예약 신청을 다시 진행해 주세요.');
      const nights = checkStay(config, input);
      const { name, phone, memo } = guestOf(input);
      // 같은 요청의 재전송(두 번 누름·새로고침)은 기존 신청을 그대로 돌려준다
      const { rows: [prior] } = await c.query('SELECT * FROM jshouse_bookings WHERE owner_hash=$1 AND request_id=$2', [hash(owner), input.requestId]);
      if (prior) {
        if (!sameStay(prior, input, phone)) fail('이미 접수된 신청입니다. 새로 진행해 주세요.', 409);
        return { booking: publicBooking(prior), created: false, row: prior, config };
      }
      const { rows: [active] } = await c.query("SELECT count(*)::int AS n FROM jshouse_bookings WHERE owner_hash=$1 AND status='requested'", [hash(owner)]);
      if (active.n >= 2) fail('확인을 기다리는 예약 신청이 이미 있어요. 먼저 접수된 신청을 확인해 주세요.', 409);
      const quote = await quoteFor(c, config, input, nights);
      if (payMode(config) && quote.total !== null) fail('이 일정은 카드 결제로 바로 예약할 수 있어요. 새로고침한 뒤 다시 진행해 주세요.', 409);
      const id = randomUUID(), code = await freshCode(c);
      const { rows: [row] } = await c.query(
        `INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,room,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,created_at,updated_at)
         VALUES($1,$2,$3,$4,'requested',$13,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
        [id, code, input.requestId, hash(owner), input.checkIn, input.checkOut, input.guests, name, phone, memo, JSON.stringify(quote), now(), input.room]);
      await hold(c, input.room, nights, id);
      await log(c, 'requested', id);
      return { booking: publicBooking(row), created: true, row, config };
    });
  }

  // ── 카드 결제 ────────────────────────────────────────────────
  const paymentOf = row => ({ booking: publicBooking(row), orderId: row.id, amount: row.amount, payable: row.status === 'pending' });
  async function owned(c, id, owner) {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) fail('예약을 찾을 수 없습니다.', 404);
    const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE id=$1 FOR UPDATE', [id]);
    if (!row || (owner !== null && row.owner_hash !== hash(owner))) fail('예약을 찾을 수 없습니다.', 404);
    return row;
  }
  // 결제 시작 — 금액·규정을 다시 확인하고 날짜를 15분 동안 잡는다. 결제창은 이 응답의 orderId·amount로 연다.
  async function reserve(input, owner) {
    return tx(async (c, config) => {
      await expire(c);
      if (!config.open) fail('지금은 예약을 받지 않고 있어요.', 409);
      if (!payMode(config)) fail('지금은 카드 결제를 받을 수 없어요. 새로고침한 뒤 다시 진행해 주세요.', 409);
      if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)) fail('예약을 다시 진행해 주세요.');
      const nights = checkStay(config, input);
      const { name, phone, memo } = guestOf(input);
      if (input.agreedTerms !== true) fail('취소·환불 규정에 동의해 주세요.');
      const { rows: [prior] } = await c.query('SELECT * FROM jshouse_bookings WHERE owner_hash=$1 AND request_id=$2', [hash(owner), input.requestId]);
      if (prior) {
        if (!sameStay(prior, input, phone) || prior.amount !== input.amount) fail('이미 진행한 예약 요청입니다. 새로 진행해 주세요.', 409);
        return { ...paymentOf(prior), created: false, row: prior, config };
      }
      // 같은 브라우저에서 결제창만 열고 끝내지 않은 예약은 새로 시작할 때 정리한다 (승인 전이라 결제된 금액이 없다)
      await c.query("DELETE FROM jshouse_nights WHERE booking_id IN (SELECT id FROM jshouse_bookings WHERE owner_hash=$1 AND status='pending')", [hash(owner)]);
      await c.query("UPDATE jshouse_bookings SET status='expired',updated_at=$2 WHERE owner_hash=$1 AND status='pending'", [hash(owner), now()]);
      const { rows: [active] } = await c.query("SELECT count(*)::int AS n FROM jshouse_bookings WHERE owner_hash=$1 AND status='confirming'", [hash(owner)]);
      if (active.n >= 2) fail('결제 확인 중인 예약이 있어요. 예약 조회에서 먼저 확인해 주세요.', 409);
      const quote = await quoteFor(c, config, input, nights);
      if (quote.total === null) fail('요금이 정해지지 않은 날짜가 포함되어 있어요. 새로고침한 뒤 다시 진행해 주세요.', 409);
      if (input.amount !== quote.total || input.termsKey !== termsKey(config.refundTerms)) fail('요금 또는 취소·환불 규정이 변경되었어요. 다시 확인해 주세요.', 409);
      const id = randomUUID(), code = await freshCode(c), expires = new Date(now().getTime() + HOLD_MINUTES * 60000);
      const { rows: [row] } = await c.query(
        `INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,room,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,amount,expires_at,created_at,updated_at)
         VALUES($1,$2,$3,$4,'pending',$15,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,
        [id, code, input.requestId, hash(owner), input.checkIn, input.checkOut, input.guests, name, phone, memo,
          JSON.stringify({ ...quote, refundTerms: config.refundTerms }), quote.total, expires, now(), input.room]);
      await hold(c, input.room, nights, id);
      await log(c, 'pay_started', id, { amount: quote.total });
      return { ...paymentOf(row), created: true, row, config };
    });
  }
  // 결제 대행사가 알려준 결제 상태를 예약에 반영한다. changed: 'confirmed' | 'cancelled' | 'expired' | null
  async function finish(id, payment) {
    return tx(async (c, config) => {
      const r = await owned(c, id, null);
      if (!payment || payment.orderId !== r.id || payment.totalAmount !== r.amount || payment.currency !== 'KRW') fail('결제 정보가 일치하지 않습니다. 예약번호로 문의해 주세요.', 409);
      if (r.payment_key && payment.paymentKey !== r.payment_key) fail('결제 식별자가 일치하지 않습니다. 예약번호로 문의해 주세요.', 409);
      let changed = null;
      if (payment.status === 'DONE' && r.status === 'confirming') {
        const { rows: [held] } = await c.query('SELECT count(*)::int AS n FROM jshouse_nights WHERE booking_id=$1', [id]);
        if (held.n !== nightsOf(iso(r.check_in), iso(r.check_out)).length) fail('예약 날짜 확인이 필요합니다. 예약번호로 문의해 주세요.', 409);
        const receipt = typeof payment.receipt?.url === 'string' && payment.receipt.url.startsWith('https://') ? payment.receipt.url : null;
        await c.query("UPDATE jshouse_bookings SET status='confirmed',payment_key=$2,receipt_url=$3,paid_at=$4,updated_at=$4 WHERE id=$1", [id, payment.paymentKey, receipt, now()]);
        await log(c, 'paid', id, { amount: r.amount });
        changed = 'confirmed';
      } else if (['ABORTED', 'EXPIRED'].includes(payment.status) && r.status === 'confirming') {
        // 승인 거절·결제 시간 만료 — 결제된 금액이 없으므로 날짜를 돌려준다
        await c.query("UPDATE jshouse_bookings SET status='expired',updated_at=$2 WHERE id=$1", [id, now()]);
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [id]);
        await log(c, 'pay_failed', id, { status: payment.status });
        changed = 'expired';
      } else if (['CANCELED', 'PARTIAL_CANCELED'].includes(payment.status) && r.status === 'cancelling') {
        const refunded = (payment.cancels || []).reduce((sum, x) => sum + x.cancelAmount, 0);
        if (refunded !== r.refund_amount) fail('환불 금액 확인이 필요합니다.', 409);
        await c.query("UPDATE jshouse_bookings SET status='cancelled',cancel_requested=false,updated_at=$2 WHERE id=$1", [id, now()]);
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [id]);
        await log(c, 'refunded', id, { refundAmount: refunded });
        changed = 'cancelled';
      }
      const after = await owned(c, id, null);
      return { ...paymentOf(after), row: after, changed, config };
    });
  }
  // 결제창에서 돌아온 뒤 서버에서 승인한다. 주문번호·결제키·금액이 모두 맞아야 하므로 브라우저가 달라도 승인할 수 있다.
  async function confirm(input) {
    const r = await tx(async c => {
      await expire(c);
      const r = await owned(c, input.orderId, null);
      if (r.amount === null || input.amount !== r.amount) fail('결제 금액이 일치하지 않습니다.', 409);
      if (!['pending', 'confirming'].includes(r.status) && !(r.status === 'confirmed' && r.paid_at)) fail('결제 시간이 지났거나 취소된 예약이에요. 결제는 승인되지 않았습니다. 날짜를 다시 골라 주세요.', 409);
      if (typeof input.paymentKey !== 'string' || input.paymentKey.length < 10 || input.paymentKey.length > 300) fail('결제 정보를 확인해 주세요.');
      if (r.payment_key && r.payment_key !== input.paymentKey) fail('이미 다른 결제가 연결된 예약입니다.', 409);
      if (r.status === 'pending') {
        await c.query("UPDATE jshouse_bookings SET status='confirming',payment_key=$2,updated_at=$3 WHERE id=$1", [r.id, input.paymentKey, now()]);
        await log(c, 'confirming', r.id);
      }
      return r;
    });
    if (r.status === 'confirmed') return { ...paymentOf(r), row: r, changed: null, config: await readConfig() };
    let payment;
    try {
      // 같은 예약에는 늘 같은 중복 방지 키를 쓰므로 두 번 눌러도 한 번만 승인된다 (연동 쪽에서 처리)
      payment = await provider.confirm({ orderId: r.id, paymentKey: input.paymentKey, amount: r.amount });
    } catch (error) {
      // 카드사 거절처럼 결제 대행사가 분명히 답한 경우에는 주문 상태를 다시 읽어 정리한다. 응답이 없었다면 '확인 중'으로 둔다.
      if (!error || !error.providerCode) throw error;
      let settled;
      try { settled = await finish(r.id, await provider.lookup(r.id)); } catch { throw error; }
      if (settled.row.status === 'confirming') throw error;
      return settled;
    }
    return finish(r.id, payment);
  }
  // 결제창을 닫았거나 결제에 실패했을 때 — 잡아 둔 날짜를 바로 돌려준다
  async function abandon(id, owner) {
    return tx(async (c, config) => {
      const r = await owned(c, id, owner);
      if (r.status === 'pending') {
        await c.query("UPDATE jshouse_bookings SET status='expired',updated_at=$2 WHERE id=$1", [id, now()]);
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [id]);
        await log(c, 'pay_abandoned', id);
      }
      const after = await owned(c, id, owner);
      return { ...paymentOf(after), row: after, changed: null, config };
    });
  }
  async function status(id, owner) {
    return tx(async (c, config) => {
      await expire(c);
      const r = await owned(c, id, owner);
      return { ...paymentOf(r), row: r, changed: null, config };
    });
  }
  // 승인·환불 응답을 받지 못해 '확인 중'으로 남은 예약을 결제 대행사 기록과 맞춘다
  /** @param {string} id @param {string|null} [owner] 손님 화면에서는 결제를 시작한 브라우저만, 관리자는 null */
  async function reconcile(id, owner = null) {
    const r = await tx(c => owned(c, id, owner));
    if (!['confirming', 'cancelling'].includes(r.status)) return { ...paymentOf(r), row: r, changed: null, config: await readConfig() };
    if (r.status === 'cancelling' && r.refund_amount === 0) return refund({ id, amount: 0, reason: r.cancel_reason });
    return finish(id, await provider.lookup(id));
  }
  // 결제한 예약의 취소 — 운영자가 동의된 규정에 따라 환불 금액을 정한다 (0원 = 환불 없이 취소)
  async function refund(input) {
    const { id, amount, reason } = input;
    const r = await tx(async c => {
      const r = await owned(c, id, null);
      if (!r.paid_at || r.amount === null) fail('카드로 결제한 예약만 환불 취소할 수 있습니다.', 409);
      integer(amount, 0, r.amount, '환불 금액');
      if (typeof reason !== 'string' || reason.trim().length < 2 || reason.length > 200) fail('취소 사유를 2자 이상 입력해 주세요.');
      if (r.status === 'cancelled') return r;
      if (r.status === 'cancelling') {
        if (r.refund_amount !== amount || r.cancel_reason !== reason) fail('진행 중인 취소가 있습니다. 결제 상태를 먼저 다시 확인해 주세요.', 409);
        return r;
      }
      if (r.status !== 'confirmed') fail('결제 완료된 예약만 취소할 수 있습니다.', 409);
      await c.query("UPDATE jshouse_bookings SET status='cancelling',refund_amount=$2,cancel_reason=$3,updated_at=$4 WHERE id=$1", [id, amount, reason, now()]);
      await log(c, 'cancelling', id, { amount, reason });
      return r;
    });
    if (r.status === 'cancelled') return { ...paymentOf(r), row: r, changed: null, config: await readConfig() };
    if (amount === 0) {
      return tx(async (c, config) => {
        const { rows: done } = await c.query("UPDATE jshouse_bookings SET status='cancelled',cancel_requested=false,updated_at=$2 WHERE id=$1 AND status='cancelling' AND refund_amount=0 RETURNING id", [id, now()]);
        if (done.length) { await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [id]); await log(c, 'cancelled_without_refund', id); }
        const after = await owned(c, id, null);
        return { ...paymentOf(after), row: after, changed: done.length ? 'cancelled' : null, config };
      });
    }
    return finish(id, await provider.cancel(r.payment_key, amount, reason, id));
  }

  // 조회·취소 시도 횟수 제한 (예약번호별 + 브라우저별, 15분에 10회)
  async function limit(keys) {
    for (const key of keys) {
      const { rows: [row] } = await pool.query(
        `INSERT INTO jshouse_attempts(key_hash,attempts,resets_at) VALUES($1,1,$3)
         ON CONFLICT(key_hash) DO UPDATE SET
           attempts=CASE WHEN jshouse_attempts.resets_at<=$2 THEN 1 ELSE jshouse_attempts.attempts+1 END,
           resets_at=CASE WHEN jshouse_attempts.resets_at<=$2 THEN $3 ELSE jshouse_attempts.resets_at END
         RETURNING attempts`, [hash(key), now(), new Date(now().getTime() + 15 * 60000)]);
      if (row.attempts > 10) fail('조회 시도가 많습니다. 15분 뒤에 다시 시도해 주세요.', 429);
    }
  }
  const missing = () => fail('예약번호와 휴대폰 번호를 다시 확인해 주세요.', 404);
  async function find(c, input, owner) {
    const code = cleanCode(input.code), phone = cleanPhone(input.phone);
    if (!CODE.test(code) || !isPhone(phone)) missing();
    await limit(['code:' + code, 'browser:' + hash(owner)]);
    const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE code=$1 AND guest_phone=$2', [code, phone]);
    if (!row) missing();
    return row;
  }
  // 예약번호 + 휴대폰 번호 조회. 결제·환불 확인 중인 예약은 이때 결제 기록과 다시 맞춰 본다.
  async function lookup(input, owner) {
    let row = await find(pool, input, owner);
    if (row.status === 'pending' && new Date(row.expires_at) <= now()) {
      // 결제 시간이 지난 대기 예약은 조회 시점에 정리해서 '결제 미완료'로 보여 준다
      await tx(expire);
      ({ rows: [row] } = await pool.query('SELECT * FROM jshouse_bookings WHERE id=$1', [row.id]));
    }
    if (provider && ['confirming', 'cancelling'].includes(row.status)) {
      try { return await reconcile(row.id); } catch { /* 확인이 안 되면 현재 상태 그대로 보여 준다 */ }
    }
    return { booking: publicBooking(row), row, changed: null };
  }
  // 이 브라우저에서 넣은 진행 중 신청 (번호를 다시 입력하지 않아도 보이게)
  async function mine(owner) {
    const { rows } = await pool.query(
      "SELECT * FROM jshouse_bookings WHERE owner_hash=$1 AND status IN ('requested','confirmed','confirming','cancelling') AND check_out>=$2 ORDER BY created_at DESC LIMIT 3",
      [hash(owner), today(now())]);
    return rows.map(publicBooking);
  }
  // 손님 취소 — 확정 전 신청은 바로 취소(날짜 반환), 확정된 예약(결제 포함)은 취소 요청만 남기고 운영자가 처리
  async function guestCancel(input, owner) {
    const found = await find(pool, input, owner);
    return tx(async c => {
      await expire(c);
      const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE id=$1 FOR UPDATE', [found.id]);
      if (row.status === 'pending') {
        // 결제 전 대기 상태 — 승인된 결제가 없으므로 그대로 닫는다
        await c.query("UPDATE jshouse_bookings SET status='expired',updated_at=$2 WHERE id=$1", [row.id, now()]);
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [row.id]);
        await log(c, 'pay_abandoned', row.id);
      } else if (row.status === 'requested') {
        await c.query("UPDATE jshouse_bookings SET status='cancelled',updated_at=$2 WHERE id=$1", [row.id, now()]);
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [row.id]);
        await log(c, 'guest_cancelled', row.id);
      } else if (row.status === 'confirmed' && !row.cancel_requested) {
        await c.query('UPDATE jshouse_bookings SET cancel_requested=true,updated_at=$2 WHERE id=$1', [row.id, now()]);
        await log(c, 'guest_cancel_requested', row.id);
      }
      const { rows: [after] } = await c.query('SELECT * FROM jshouse_bookings WHERE id=$1', [row.id]);
      return { booking: publicBooking(after), row: after, changed: after.status !== row.status || after.cancel_requested !== row.cancel_requested };
    });
  }

  // ── 관리자 ──────────────────────────────────────────────────
  async function admin() {
    await tx(expire);
    const config = await readConfig(), start = today(now());
    const chartStart = start.slice(0, 8) + '01'; // 블럭표는 이번 달 1일부터 12개월을 보여 준다
    const [{ rows: days }, { rows: bookings }, { rows: events }, { rows: asks }] = await Promise.all([
      pool.query('SELECT room,day,closed,price,season,note FROM jshouse_days WHERE day>=$1 ORDER BY day,room LIMIT 1600', [chartStart]),
      pool.query(`SELECT id,code,status,room,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,admin_note,cancel_requested,created_at,updated_at,
        amount,paid_at,refund_amount,cancel_reason,receipt_url,expires_at FROM jshouse_bookings ORDER BY created_at DESC LIMIT 300`),
      pool.query('SELECT e.id,e.action,e.detail,e.created_at,b.code FROM jshouse_events e LEFT JOIN jshouse_bookings b ON b.id=e.booking_id ORDER BY e.id DESC LIMIT 60'),
      // 손님이 취소를 요청한 시각 — 환불 금액은 요청한 날 기준으로 계산한다
      pool.query("SELECT booking_id,max(created_at) AS at FROM jshouse_events WHERE action='guest_cancel_requested' GROUP BY booking_id"),
    ]);
    const settings = byRoom(days), span = Array.from({ length: 400 }, (_, i) => addDays(chartStart, i));
    const askedAt = new Map(asks.map(a => [a.booking_id, new Date(a.at)]));
    return {
      today: start, config, pay: payMode(config), termsReady: termsReady(config),
      days: days.map(d => ({ ...d, day: iso(d.day) })),
      // 블럭표용: 객실 → 날짜 → 그 밤의 요금·적용 요금 칸·시즌 (손님 달력과 같은 계산)
      chart: Object.fromEntries(ROOM_KEYS.map(key => [key, Object.fromEntries(span.map(day => {
        const { price, rate, season, manual } = nightOf(day, config.rooms[key], settings[key][day], config.autoSeasons);
        return [day, { price, rate, ...(season ? { season } : {}), ...(manual ? { manual } : {}) }];
      }))])),
      bookings: bookings.map(b => {
        // 결제한 확정 예약은 표준 규정대로 계산한 환불 금액을 함께 준다 (취소 요청이 있으면 요청 시각, 없으면 지금 기준)
        const asked = b.cancel_requested ? askedAt.get(b.id) : undefined;
        const refund = b.status === 'confirmed' ? refundFor(b, asked || now()) : null;
        return { ...b, check_in: iso(b.check_in), check_out: iso(b.check_out), ...(refund ? { refund: { ...refund, asked: !!asked } } : {}) };
      }),
      events,
      seasonGuide: SEASON_GUIDE, holidaysUntil: HOLIDAYS_UNTIL, standardRefundTerms: STANDARD_REFUND_TERMS,
    };
  }
  async function saveConfig(input) {
    const config = validateConfig(input);
    return tx(async c => {
      await c.query('UPDATE jshouse_settings SET config=$1,updated_at=$2 WHERE id=1', [JSON.stringify(config), now()]);
      await log(c, 'settings_changed', null, { open: config.open });
      return { ok: true };
    });
  }
  // 날짜 범위(양 끝 포함)를 객실별로 바꾼다: 예약 닫기·열기(closed), 시즌 지정(season), 그날만의 요금(price), 메모(note).
  // 넘긴 항목만 바뀌고 나머지는 그대로 둔다. clear=true 면 그 날짜들을 요금표 기본으로 되돌린다.
  async function setDays(input) {
    date(input.start); date(input.end);
    const count = (Date.parse(input.end) - Date.parse(input.start)) / DAY + 1;
    if (count < 1 || count > 366) fail('날짜 범위를 확인해 주세요.');
    const rooms = Array.isArray(input.rooms) ? [...new Set(input.rooms)] : [];
    if (!rooms.length || !rooms.every(isRoom)) fail('적용할 객실을 선택해 주세요.');
    const days = Array.from({ length: count }, (_, i) => addDays(input.start, i));
    if (input.clear === true) {
      return tx(async c => {
        for (const room of rooms) await c.query('DELETE FROM jshouse_days WHERE room=$1 AND day>=$2 AND day<=$3', [room, input.start, input.end]);
        await log(c, 'days_cleared', null, { start: input.start, end: input.end, rooms });
        return { ok: true, count };
      });
    }
    const patch = {};
    if (input.closed !== undefined) { if (typeof input.closed !== 'boolean') fail('예약 닫기 여부를 확인해 주세요.'); patch.closed = input.closed; }
    if (input.season !== undefined) { if (!SEASONS.includes(input.season)) fail('시즌을 확인해 주세요.'); patch.season = input.season; }
    if (input.price !== undefined) patch.price = input.price === null || input.price === '' ? null : integer(Number(input.price), 1, 10000000, '1박 요금');
    if (input.note !== undefined) patch.note = text(input.note, 80, '메모');
    if (!Object.keys(patch).length) fail('바꿀 내용을 선택해 주세요.');
    return tx(async c => {
      for (const room of rooms) {
        const { rows } = await c.query('SELECT room,day,closed,price,season,note FROM jshouse_days WHERE room=$1 AND day>=$2 AND day<=$3', [room, input.start, input.end]);
        const current = byRoom(rows)[room];
        for (const day of days) {
          const before = current[day] || { closed: false, price: null, season: '', note: '' };
          const next = { closed: before.closed, price: before.price, season: before.season, note: before.note, ...patch };
          await c.query(
            `INSERT INTO jshouse_days(room,day,closed,price,season,note) VALUES($1,$2,$3,$4,$5,$6)
             ON CONFLICT(room,day) DO UPDATE SET closed=EXCLUDED.closed,price=EXCLUDED.price,season=EXCLUDED.season,note=EXCLUDED.note`,
            [room, day, next.closed, next.price, next.season, next.note]);
        }
      }
      await log(c, 'days_changed', null, { start: input.start, end: input.end, rooms, ...patch });
      return { ok: true, count };
    });
  }
  async function decide(input) {
    if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.id)) fail('예약을 찾을 수 없습니다.', 404);
    if (!['confirm', 'decline', 'cancel'].includes(input.action)) fail('잘못된 요청입니다.');
    const note = text(input.note ?? '', 300, '메모');
    return tx(async (c, config) => {
      const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE id=$1 FOR UPDATE', [input.id]);
      if (!row) fail('예약을 찾을 수 없습니다.', 404);
      const next = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[input.action];
      if (row.status === next) return { booking: publicBooking(row), row, changed: false, config };
      const allowed = { confirm: ['requested'], decline: ['requested'], cancel: ['requested', 'confirmed'] }[input.action];
      if (!allowed.includes(row.status)) fail('이미 처리된 예약입니다. 목록을 새로고침해 주세요.', 409);
      if (row.paid_at) fail('카드로 결제한 예약입니다. 환불 금액을 정해 취소해 주세요.', 409);
      if (next === 'confirmed') {
        // 확정하려는 밤이 모두 이 예약 앞으로 잡혀 있는지 다시 확인
        const { rows: [held] } = await c.query('SELECT count(*)::int AS n FROM jshouse_nights WHERE booking_id=$1', [row.id]);
        if (held.n !== nightsOf(iso(row.check_in), iso(row.check_out)).length) fail('예약 날짜 확인이 필요합니다.', 409);
      } else {
        await c.query('DELETE FROM jshouse_nights WHERE booking_id=$1', [row.id]);
      }
      const { rows: [after] } = await c.query(
        'UPDATE jshouse_bookings SET status=$2,admin_note=$3,cancel_requested=false,updated_at=$4 WHERE id=$1 RETURNING *', [row.id, next, note || row.admin_note, now()]);
      await log(c, next, row.id, note ? { note } : {});
      return { booking: publicBooking(after), row: after, changed: true, config };
    });
  }
  // 전화·다른 채널로 받은 예약을 운영자가 직접 넣는다 (바로 확정, 날짜 점유)
  async function adminCreate(input) {
    if (!isRoom(input.room)) fail('객실을 선택해 주세요.');
    const nights = nightsOf(input.checkIn, input.checkOut, 60);
    integer(input.guests, 1, 20, '인원');
    const name = text(input.guestName ?? '', 40, '예약자 이름'), phone = cleanPhone(input.guestPhone), memo = text(input.memo ?? '', 300, '메모');
    if (name.length < 1) fail('예약자 이름을 입력해 주세요.');
    if (phone && !isPhone(phone)) fail('휴대폰 번호를 확인해 주세요.');
    return tx(async (c, config) => {
      await expire(c);
      const { rows: taken } = await c.query('SELECT day FROM jshouse_nights WHERE room=$1 AND day>=$2 AND day<$3', [input.room, input.checkIn, input.checkOut]);
      if (taken.length) fail('이미 예약이 잡힌 날짜가 포함되어 있습니다.', 409);
      const { rows: days } = await c.query('SELECT room,day,price,season FROM jshouse_days WHERE room=$1 AND day>=$2 AND day<$3', [input.room, input.checkIn, input.checkOut]);
      const quote = estimate(config.rooms[input.room], byRoom(days)[input.room], nights, config.autoSeasons);
      const code = await freshCode(c);
      const id = randomUUID();
      const { rows: [row] } = await c.query(
        `INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,room,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,admin_note,created_at,updated_at)
         VALUES($1,$2,$3,'admin','confirmed',$12,$4,$5,$6,$7,$8,$9,$10,'관리자 직접 등록',$11,$11) RETURNING *`,
        [id, code, randomUUID(), input.checkIn, input.checkOut, input.guests, name, phone, memo, JSON.stringify(quote), now(), input.room]);
      await hold(c, input.room, nights, id);
      await log(c, 'admin_created', id);
      return { booking: publicBooking(row), row };
    });
  }
  // 문자 발송 결과 등 운영 기록
  async function note(bookingId, action, detail = {}) {
    await log(pool, action, bookingId, detail);
  }
  return { calendar, request, reserve, confirm, abandon, status, reconcile, refund, lookup, mine, guestCancel, admin, saveConfig, setDays, decide, adminCreate, note, readConfig, payMode };
}

module.exports = {
  StayError, DEFAULT_CONFIG, DEFAULT_ROOMS, ROOM_KEYS, ROOM_NAMES, RATE_KEYS, RATE_NAMES, SEASONS,
  hash, iso, today, addDays, date, nightsOf, mergeConfig, validateConfig, publicConfig,
  nightOf, rateOf, priceOf, estimate, refundFor, cleanCode, cleanPhone, publicBooking, termsKey, HOLD_MINUTES, service,
  SEASON_GUIDE, STANDARD_REFUND_TERMS,
};
