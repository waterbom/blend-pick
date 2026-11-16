// JS하우스(연남동) 예약 신청 원장.
//
// 흐름: 손님이 달력에서 날짜를 골라 "예약 신청" → 그 밤들이 바로 점유(다른 손님에게 마감 표시)
//       → 운영자가 관리자 화면에서 확정/거절 → 거절·취소되면 날짜가 다시 열린다.
// 요금·결제는 아직 온라인으로 받지 않는다. 관리자에서 1박 요금을 넣으면 달력과 예상 금액에 표시만 된다.
// 단궁(dangung-core.cjs)의 결제 원장과는 테이블·코드 모두 분리되어 있다.
const { randomUUID, randomInt, createHash } = require('node:crypto');

class StayError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new StayError(message, status); };
const hash = value => createHash('sha256').update(value).digest('hex');
const DAY = 86400000;
const iso = d => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
// 한국 시간 기준 오늘 (서버는 UTC)
const today = (now = new Date()) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);

const DEFAULT_CONFIG = Object.freeze({
  open: true,          // 예약 신청 받기
  minLeadDays: 1,      // 오늘로부터 며칠 뒤 입실부터 받을지 (0 = 당일)
  maxNights: 14,       // 한 번에 신청할 수 있는 최대 숙박일
  windowDays: 180,     // 오늘로부터 며칠 뒤까지 달력을 열지
  maxGuests: 4,        // 최대 인원
  weekdayPrice: null,  // 일~목 1박 요금 (원). null 이면 "요금은 확인 후 안내"
  weekendPrice: null,  // 금·토 1박 요금. null 이면 주중 요금과 같음
  checkInTime: '',     // "15:00" 형식. 비우면 "예약 확정 시 안내"
  checkOutTime: '',
  address: '',         // 공개 주소. 비우면 "예약 확정 후 안내"
  walkNote: '',        // 예: "홍대입구역 3번 출구에서 걸어서 8분"
  parkingNote: '',     // 예: "주차 불가 · 인근 공영주차장 이용"
  mapUrl: '',          // 지도 링크 (https)
  notice: '',          // 예약 영역 상단 한 줄 공지
  rules: '',           // 이용 안내 (한 줄에 하나)
  notifyPhone: '',     // 새 신청 알림을 받을 운영자 휴대폰 (공개 안 됨)
});
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
    for (const key of Object.keys(DEFAULT_CONFIG)) if (stored[key] !== undefined) merged[key] = stored[key];
  }
  return merged;
}
function validateConfig(input) {
  const c = mergeConfig(input);
  if (typeof c.open !== 'boolean') fail('예약 신청 받기 여부를 확인해 주세요.');
  integer(c.minLeadDays, 0, 60, '예약 준비일');
  integer(c.maxNights, 1, 30, '최대 숙박일');
  integer(c.windowDays, 14, 365, '달력 공개 기간');
  integer(c.maxGuests, 1, 20, '최대 인원');
  for (const [key, name] of [['weekdayPrice', '주중 1박 요금'], ['weekendPrice', '금·토 1박 요금']]) {
    if (c[key] !== null) integer(c[key], 1, 10000000, name);
  }
  if (c.weekdayPrice === null && c.weekendPrice !== null) fail('주중 1박 요금을 먼저 입력해 주세요.');
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
  return c;
}
function publicConfig(config) {
  const out = { ...config };
  for (const key of PRIVATE_KEYS) delete out[key];
  return out;
}

// 금·토 밤은 주말 요금
const isWeekend = day => [5, 6].includes(new Date(day + 'T00:00:00Z').getUTCDay());
function priceOf(day, config, override) {
  if (override !== undefined && override !== null) return override;
  if (config.weekdayPrice === null) return null;
  return isWeekend(day) ? (config.weekendPrice ?? config.weekdayPrice) : config.weekdayPrice;
}
// 예상 금액 — 요금이 없는 밤이 하나라도 있으면 합계를 내지 않는다
function estimate(config, overrides, nights) {
  const nightly = nights.map(day => ({ day, price: priceOf(day, config, overrides[day]) }));
  const total = nightly.every(n => n.price !== null) ? nightly.reduce((s, n) => s + n.price, 0) : null;
  return { nightly, total };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0·O·1·I 제외
const newCode = () => 'JS-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const cleanCode = value => (typeof value === 'string' ? value.trim().toUpperCase().replace(/^JS(?=[A-Z2-9]{6}$)/, 'JS-') : '');
const cleanPhone = value => (typeof value === 'string' ? value.replace(/[^0-9]/g, '') : '');

const publicBooking = r => ({
  code: r.code, status: r.status,
  checkIn: iso(r.check_in), checkOut: iso(r.check_out),
  nights: Math.round((Date.parse(iso(r.check_out)) - Date.parse(iso(r.check_in))) / DAY),
  guests: r.guests, guestName: r.guest_name,
  estimate: r.estimate || {}, cancelRequested: r.cancel_requested,
  createdAt: new Date(r.created_at).toISOString(),
});

function service(pool, { now = () => new Date() } = {}) {
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
  const log = (c, action, bookingId, detail = {}) =>
    c.query('INSERT INTO jshouse_events(booking_id,action,detail) VALUES($1,$2,$3)', [bookingId, action, JSON.stringify(detail)]);

  async function readConfig() {
    const { rows: [s] } = await pool.query('SELECT config FROM jshouse_settings WHERE id=1');
    if (!s) fail('예약 설정을 준비 중입니다.', 503);
    return mergeConfig(s.config);
  }

  // 공개 달력 — 예외 날짜(닫힘·별도 요금)와 이미 잡힌 밤만 내려준다. 나머지는 화면이 기본 설정으로 계산.
  async function calendar() {
    const config = await readConfig(), start = today(now()), end = addDays(start, config.windowDays);
    const [{ rows: days }, { rows: taken }] = await Promise.all([
      pool.query('SELECT day,closed,price FROM jshouse_days WHERE day>=$1 AND day<=$2 ORDER BY day', [start, end]),
      pool.query('SELECT day FROM jshouse_nights WHERE day>=$1 AND day<=$2 ORDER BY day', [start, end]),
    ]);
    return {
      today: start, lastDay: end, config: publicConfig(config),
      closed: days.filter(d => d.closed).map(d => iso(d.day)),
      prices: Object.fromEntries(days.filter(d => d.price !== null).map(d => [iso(d.day), d.price])),
      taken: taken.map(d => iso(d.day)),
    };
  }

  function checkStay(config, input) {
    const nights = nightsOf(input.checkIn, input.checkOut, config.maxNights);
    const start = today(now());
    if (input.checkIn < addDays(start, config.minLeadDays) || input.checkOut > addDays(start, config.windowDays)) fail('예약 가능한 날짜를 선택해 주세요.');
    integer(input.guests, 1, config.maxGuests, '인원');
    return nights;
  }

  async function request(input, owner) {
    return tx(async (c, config) => {
      if (!config.open) fail('지금은 예약 신청을 받지 않고 있어요.', 409);
      if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)) fail('예약 신청을 다시 진행해 주세요.');
      const nights = checkStay(config, input);
      const name = typeof input.guestName === 'string' ? input.guestName.trim() : '';
      const phone = cleanPhone(input.guestPhone), memo = typeof input.memo === 'string' ? input.memo.trim() : null;
      if (name.length < 2 || name.length > 40 || !isPhone(phone) || memo === null || memo.length > 300) fail('예약자 이름·휴대폰 번호·요청사항을 확인해 주세요.');
      if (input.agreed !== true) fail('개인정보 수집·이용에 동의해 주세요.');
      // 같은 요청의 재전송(두 번 누름·새로고침)은 기존 신청을 그대로 돌려준다
      const { rows: [prior] } = await c.query('SELECT * FROM jshouse_bookings WHERE owner_hash=$1 AND request_id=$2', [hash(owner), input.requestId]);
      if (prior) {
        if (iso(prior.check_in) !== input.checkIn || iso(prior.check_out) !== input.checkOut || prior.guests !== input.guests || prior.guest_phone !== phone) fail('이미 접수된 신청입니다. 새로 진행해 주세요.', 409);
        return { booking: publicBooking(prior), created: false, row: prior, config };
      }
      const { rows: [active] } = await c.query("SELECT count(*)::int AS n FROM jshouse_bookings WHERE owner_hash=$1 AND status='requested'", [hash(owner)]);
      if (active.n >= 2) fail('확인을 기다리는 예약 신청이 이미 있어요. 먼저 접수된 신청을 확인해 주세요.', 409);
      const { rows: closed } = await c.query('SELECT day FROM jshouse_days WHERE day>=$1 AND day<$2 AND closed', [input.checkIn, input.checkOut]);
      const { rows: taken } = await c.query('SELECT day FROM jshouse_nights WHERE day>=$1 AND day<$2', [input.checkIn, input.checkOut]);
      if (closed.length || taken.length) fail('선택한 기간에 이미 마감된 날짜가 있어요. 다른 날짜를 골라 주세요.', 409);
      const { rows: overrides } = await c.query('SELECT day,price FROM jshouse_days WHERE day>=$1 AND day<$2 AND price IS NOT NULL', [input.checkIn, input.checkOut]);
      const quote = estimate(config, Object.fromEntries(overrides.map(d => [iso(d.day), d.price])), nights);
      let code = newCode();
      for (let i = 0; i < 5; i++) {
        const { rows: [dup] } = await c.query('SELECT 1 FROM jshouse_bookings WHERE code=$1', [code]);
        if (!dup) break;
        code = newCode();
      }
      const id = randomUUID();
      const { rows: [row] } = await c.query(
        `INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,created_at,updated_at)
         VALUES($1,$2,$3,$4,'requested',$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
        [id, code, input.requestId, hash(owner), input.checkIn, input.checkOut, input.guests, name, phone, memo, JSON.stringify(quote), now()]);
      for (const day of nights) await c.query('INSERT INTO jshouse_nights(day,booking_id) VALUES($1,$2)', [day, id]);
      await log(c, 'requested', id);
      return { booking: publicBooking(row), created: true, row, config };
    });
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
    if (!/^JS-[A-Z2-9]{6}$/.test(code) || !isPhone(phone)) missing();
    await limit(['code:' + code, 'browser:' + hash(owner)]);
    const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE code=$1 AND guest_phone=$2', [code, phone]);
    if (!row) missing();
    return row;
  }
  async function lookup(input, owner) {
    return publicBooking(await find(pool, input, owner));
  }
  // 이 브라우저에서 넣은 진행 중 신청 (번호를 다시 입력하지 않아도 보이게)
  async function mine(owner) {
    const { rows } = await pool.query(
      "SELECT * FROM jshouse_bookings WHERE owner_hash=$1 AND status IN ('requested','confirmed') AND check_out>=$2 ORDER BY created_at DESC LIMIT 3",
      [hash(owner), today(now())]);
    return rows.map(publicBooking);
  }
  // 손님 취소 — 확정 전이면 바로 취소(날짜 반환), 확정 후면 취소 요청만 남기고 운영자가 처리
  async function guestCancel(input, owner) {
    const found = await find(pool, input, owner);
    return tx(async c => {
      const { rows: [row] } = await c.query('SELECT * FROM jshouse_bookings WHERE id=$1 FOR UPDATE', [found.id]);
      if (row.status === 'requested') {
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
    const config = await readConfig(), start = today(now());
    const [{ rows: days }, { rows: bookings }, { rows: events }] = await Promise.all([
      pool.query('SELECT day,closed,price,note FROM jshouse_days WHERE day>=$1 ORDER BY day LIMIT 800', [start]),
      pool.query('SELECT id,code,status,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,admin_note,cancel_requested,created_at,updated_at FROM jshouse_bookings ORDER BY created_at DESC LIMIT 300'),
      pool.query('SELECT e.id,e.action,e.detail,e.created_at,b.code FROM jshouse_events e LEFT JOIN jshouse_bookings b ON b.id=e.booking_id ORDER BY e.id DESC LIMIT 60'),
    ]);
    return {
      today: start, config,
      days: days.map(d => ({ ...d, day: iso(d.day) })),
      bookings: bookings.map(b => ({ ...b, check_in: iso(b.check_in), check_out: iso(b.check_out) })),
      events,
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
  // 날짜 범위(양 끝 포함) 닫기·열기·요금 지정. clear=true 면 기본 설정으로 되돌린다.
  async function setDays(input) {
    date(input.start); date(input.end);
    const count = (Date.parse(input.end) - Date.parse(input.start)) / DAY + 1;
    if (count < 1 || count > 366) fail('날짜 범위를 확인해 주세요.');
    const days = Array.from({ length: count }, (_, i) => addDays(input.start, i));
    if (input.clear === true) {
      return tx(async c => {
        await c.query('DELETE FROM jshouse_days WHERE day>=$1 AND day<=$2', [input.start, input.end]);
        await log(c, 'days_cleared', null, { start: input.start, end: input.end });
        return { ok: true, count };
      });
    }
    if (typeof input.closed !== 'boolean') fail('예약 닫기 여부를 확인해 주세요.');
    const price = input.price === null || input.price === undefined || input.price === '' ? null : integer(Number(input.price), 1, 10000000, '1박 요금');
    const note = text(input.note ?? '', 80, '메모');
    return tx(async c => {
      for (const day of days) {
        await c.query(
          `INSERT INTO jshouse_days(day,closed,price,note) VALUES($1,$2,$3,$4)
           ON CONFLICT(day) DO UPDATE SET closed=EXCLUDED.closed,price=EXCLUDED.price,note=EXCLUDED.note`, [day, input.closed, price, note]);
      }
      await log(c, 'days_changed', null, { start: input.start, end: input.end, closed: input.closed, price });
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
    const nights = nightsOf(input.checkIn, input.checkOut, 60);
    integer(input.guests, 1, 20, '인원');
    const name = text(input.guestName ?? '', 40, '예약자 이름'), phone = cleanPhone(input.guestPhone), memo = text(input.memo ?? '', 300, '메모');
    if (name.length < 1) fail('예약자 이름을 입력해 주세요.');
    if (phone && !isPhone(phone)) fail('휴대폰 번호를 확인해 주세요.');
    return tx(async (c, config) => {
      const { rows: taken } = await c.query('SELECT day FROM jshouse_nights WHERE day>=$1 AND day<$2', [input.checkIn, input.checkOut]);
      if (taken.length) fail('이미 예약이 잡힌 날짜가 포함되어 있습니다.', 409);
      const { rows: overrides } = await c.query('SELECT day,price FROM jshouse_days WHERE day>=$1 AND day<$2 AND price IS NOT NULL', [input.checkIn, input.checkOut]);
      const quote = estimate(config, Object.fromEntries(overrides.map(d => [iso(d.day), d.price])), nights);
      let code = newCode();
      for (let i = 0; i < 5; i++) {
        const { rows: [dup] } = await c.query('SELECT 1 FROM jshouse_bookings WHERE code=$1', [code]);
        if (!dup) break;
        code = newCode();
      }
      const id = randomUUID();
      const { rows: [row] } = await c.query(
        `INSERT INTO jshouse_bookings(id,code,request_id,owner_hash,status,check_in,check_out,guests,guest_name,guest_phone,memo,estimate,admin_note,created_at,updated_at)
         VALUES($1,$2,$3,'admin','confirmed',$4,$5,$6,$7,$8,$9,$10,'관리자 직접 등록',$11,$11) RETURNING *`,
        [id, code, randomUUID(), input.checkIn, input.checkOut, input.guests, name, phone, memo, JSON.stringify(quote), now()]);
      for (const day of nights) await c.query('INSERT INTO jshouse_nights(day,booking_id) VALUES($1,$2)', [day, id]);
      await log(c, 'admin_created', id);
      return { booking: publicBooking(row), row };
    });
  }
  // 문자 발송 결과 등 운영 기록
  async function note(bookingId, action, detail = {}) {
    await pool.query('INSERT INTO jshouse_events(booking_id,action,detail) VALUES($1,$2,$3)', [bookingId, action, JSON.stringify(detail)]);
  }
  return { calendar, request, lookup, mine, guestCancel, admin, saveConfig, setDays, decide, adminCreate, note, readConfig };
}

module.exports = {
  StayError, DEFAULT_CONFIG, hash, iso, today, addDays, date, nightsOf, mergeConfig, validateConfig, publicConfig,
  isWeekend, priceOf, estimate, cleanCode, cleanPhone, publicBooking, service,
};
