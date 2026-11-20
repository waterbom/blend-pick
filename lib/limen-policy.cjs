// LIMEN 시즌 달력과 취소·환불 표준 규정 — 날짜만으로 계산되는 규칙을 한곳에 모았다 (DB·환경 변수를 쓰지 않는다).
//
// 1) 시즌 달력 — 2026-11 에 리조트·호텔·펜션의 기간표와 공정거래위원회 기준을 조사해 정했다 (근거: docs/limen.md).
//    날짜는 모두 '숙박하는 밤'(입실하는 날) 기준이다.
//     · 여름 7.15–8.24 가 성수기 (공정위 「소비자분쟁해결기준」의 기본 여름 성수기). 그중 7.20–8.15 는 극성수기, 앞뒤는 준성수기.
//     · 연말 12.20–12.31 은 준성수기, 그중 12.24 · 12.25 · 12.31 은 극성수기.
//     · 설·추석 연휴: 연휴 전날 밤부터 연휴 마지막 날 전날 밤까지 준성수기.
//     · 평일에 드는 공휴일(대체공휴일 포함)의 전날 밤은 토요일 요금.
//    운영자가 블럭표에서 날짜에 시즌을 지정하면 그 값이 먼저이고, 설정의 '성수기·공휴일 자동 적용'을 끄면 이 달력은 쓰지 않는다.
//
// 2) 취소·환불 표준 규정 — 공정거래위원회 「소비자분쟁해결기준」(숙박업)의 소비자 사정 취소 기준을 그대로 옮겼다.
//    성수기 = 준성수기·극성수기 요금이 적용되는 밤, 주말 = 금·토요일과 공휴일 전날 밤 (같은 기준의 정의).
const DAY = 86400000;
// 한국 시간 기준 오늘 (서버는 UTC)
const today = (now = new Date()) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = day => new Date(day + 'T00:00:00Z').getUTCDay();

// 관공서 공휴일 (대체공휴일 포함): [날짜, 이름, 명절 연휴인지].
// 음력 명절과 대체공휴일은 해마다 달라서 표로 둔다. 2027년은 2026-06 에 발표된 월력요항 기준이고,
// 2028년은 발표 전 달력 기준이라 2027-06 월력요항이 나오면 다시 확인한다. 해가 바뀌기 전에 다음 해를 덧붙인다.
// 선거일·임시공휴일은 넣지 않았다 — 필요하면 블럭표에서 그 날짜에 요금이나 시즌을 지정한다.
const HOLIDAY_ROWS = [
  ['2026-12-25', '성탄절'],
  ['2027-01-01', '신정'],
  ['2027-02-06', '설 연휴', true], ['2027-02-07', '설날', true], ['2027-02-08', '설 연휴', true], ['2027-02-09', '설 대체공휴일', true],
  ['2027-03-01', '삼일절'],
  ['2027-05-01', '노동절'], ['2027-05-03', '노동절 대체공휴일'], ['2027-05-05', '어린이날'], ['2027-05-13', '부처님오신날'],
  ['2027-06-06', '현충일'],
  ['2027-07-17', '제헌절'], ['2027-07-19', '제헌절 대체공휴일'],
  ['2027-08-15', '광복절'], ['2027-08-16', '광복절 대체공휴일'],
  ['2027-09-14', '추석 연휴', true], ['2027-09-15', '추석', true], ['2027-09-16', '추석 연휴', true],
  ['2027-10-03', '개천절'], ['2027-10-04', '개천절 대체공휴일'], ['2027-10-09', '한글날'], ['2027-10-11', '한글날 대체공휴일'],
  ['2027-12-25', '성탄절'], ['2027-12-27', '성탄절 대체공휴일'],
  ['2028-01-01', '신정'],
  ['2028-01-26', '설 연휴', true], ['2028-01-27', '설날', true], ['2028-01-28', '설 연휴', true],
  ['2028-03-01', '삼일절'],
  ['2028-05-01', '노동절'], ['2028-05-02', '부처님오신날'], ['2028-05-05', '어린이날'],
  ['2028-06-06', '현충일'], ['2028-07-17', '제헌절'], ['2028-08-15', '광복절'],
  ['2028-10-02', '추석 연휴', true], ['2028-10-03', '추석', true], ['2028-10-04', '추석 연휴', true], ['2028-10-05', '개천절 대체공휴일', true],
  ['2028-10-09', '한글날'], ['2028-12-25', '성탄절'],
];
const HOLIDAYS = new Map(HOLIDAY_ROWS.map(([day, name, feast = false]) => [day, { name, feast }]));
const HOLIDAYS_UNTIL = '2028-12-31'; // 이 날짜까지의 공휴일이 표에 들어 있다

// 해마다 같은 날짜에 오는 시즌: [시작(월-일), 끝(포함), 시즌]
const SEASON_RANGES = [
  ['07-15', '07-19', 'shoulder'], ['07-20', '08-15', 'peak'], ['08-16', '08-24', 'shoulder'],
  ['12-20', '12-23', 'shoulder'], ['12-24', '12-25', 'peak'], ['12-26', '12-30', 'shoulder'], ['12-31', '12-31', 'peak'],
];
// 손님 화면·관리자 화면에 그대로 보여 주는 안내 (위 표와 같은 내용)
const SEASON_GUIDE = [
  { key: 'peak', label: '극성수기', text: '7월 20일–8월 15일 · 12월 24·25·31일' },
  { key: 'shoulder', label: '준성수기', text: '7월 15–19일 · 8월 16–24일 · 12월 20–30일 · 설·추석 연휴' },
  { key: 'holiday', label: '공휴일 전날', text: '토요일 요금 (평일에 드는 공휴일의 전날 밤)' },
];

/** 그 밤의 자동 시즌: 'peak' 극성수기 · 'shoulder' 준성수기 · 'holiday' 공휴일 전날(토요일 요금) · '' 평시 */
function autoSeason(day) {
  const monthDay = day.slice(5), range = SEASON_RANGES.find(([from, to]) => monthDay >= from && monthDay <= to);
  if (range && range[2] === 'peak') return 'peak';
  const tomorrow = addDays(day, 1), holiday = HOLIDAYS.get(tomorrow);
  if (range || (holiday && holiday.feast)) return 'shoulder';
  // 다음 날이 평일인데 쉬는 날 — 토요일 밤처럼 받는다. 주말에 드는 공휴일은 요일 요금 그대로.
  const weekday = weekdayOf(tomorrow);
  return holiday && weekday >= 1 && weekday <= 5 ? 'holiday' : '';
}
// 환불 기준의 '주말': 금·토요일 숙박과 공휴일 전날 숙박
const isWeekendNight = day => [5, 6].includes(weekdayOf(day)) || HOLIDAYS.has(addDays(day, 1));

// 취소·환불 표준 규정: [입실 며칠 전까지 취소, 주중 공제율(%), 주말 공제율(%)] — 위에서부터 처음 맞는 줄을 쓴다
const REFUND_STEPS = {
  high: [[10, 0, 0], [7, 10, 20], [5, 30, 40], [3, 50, 60], [0, 80, 90]], // 성수기
  low: [[2, 0, 0], [1, 10, 20], [0, 20, 30]],                             // 비수기
};
const FREE_CANCEL_HOURS = 24; // 결제 후 이 시간 안에 취소하면 위약금이 없다 (입실일 0시 전까지)
const stepLabel = (steps, i) => {
  const upper = steps[i - 1][0] - 1, lower = steps[i][0];
  if (lower === 0) return upper === 0 ? '입실 당일, 미입실' : `입실 ${upper}일 전~당일, 미입실`;
  return upper === lower ? `입실 ${lower}일 전` : `입실 ${upper}~${lower}일 전`;
};
const stepLines = steps => steps.slice(1).map((step, i) => `· ${stepLabel(steps, i + 1)}: 주중 ${100 - step[1]}% · 주말 ${100 - step[2]}% 환불`);
// 손님이 결제 전에 읽고 동의하는 글. 예약마다 동의한 글이 그대로 저장되므로, 이 글을 고치면 그 뒤 예약부터 적용된다.
const STANDARD_REFUND_TERMS = [
  'LIMEN의 취소·환불은 공정거래위원회 「소비자분쟁해결기준(숙박업)」을 따릅니다.',
  '',
  '■ 전액 환불',
  `· 결제 후 ${FREE_CANCEL_HOURS}시간 이내 취소 (입실일 0시 전까지)`,
  `· 성수기: 입실 ${REFUND_STEPS.high[0][0]}일 전까지 취소`,
  `· 비수기: 입실 ${REFUND_STEPS.low[0][0]}일 전까지 취소`,
  '',
  '■ 성수기 — 준성수기·극성수기 요금이 적용되는 날에 입실',
  ...stepLines(REFUND_STEPS.high),
  '',
  '■ 비수기 — 그 밖의 날에 입실',
  ...stepLines(REFUND_STEPS.low),
  '',
  '■ 계산 기준',
  '· 환불 금액은 총 결제 금액에 위 비율을 곱한 금액입니다.',
  '· 성수기·비수기와 주중·주말은 입실일을 기준으로 합니다. 주말은 금·토요일과 공휴일 전날 입실입니다.',
  '· 날짜는 한국 시간 기준이며, 취소를 요청하신 날로 계산합니다.',
  '· 태풍·폭설 같은 천재지변으로 머물 수 없게 된 경우에는 전액 환불합니다.',
  '· 숙소 사정으로 예약을 취소하게 되면 전액 환불하고, 같은 기준에 따라 배상합니다.',
  '· 취소는 예약 조회에서 요청해 주세요. 환불은 결제하신 카드로 취소되며, 카드사에 따라 영업일 기준 3~7일이 걸릴 수 있습니다.',
].join('\n');

/**
 * 표준 규정에 따른 환불 금액.
 * @param {{amount:number, checkIn:string, high:boolean, weekend:boolean, paidAt?:Date|string|null}} stay
 *   high: 입실일이 성수기(준성수기·극성수기)인지, weekend: 입실일이 주말(금·토·공휴일 전날)인지
 * @param {Date} at 취소를 요청한 시각
 */
function refundQuote(stay, at) {
  const daysBefore = Math.round((Date.parse(stay.checkIn) - Date.parse(today(at))) / DAY);
  const free = !!stay.paidAt && at.getTime() - new Date(stay.paidAt).getTime() <= FREE_CANCEL_HOURS * 3600000 && daysBefore >= 1;
  const steps = REFUND_STEPS[stay.high ? 'high' : 'low'];
  const step = steps.find(([before]) => daysBefore >= before) || steps[steps.length - 1];
  const percent = free ? 0 : step[stay.weekend ? 2 : 1];
  const fee = Math.round(stay.amount * percent / 100);
  const when = daysBefore >= 1 ? `입실 ${daysBefore}일 전` : daysBefore === 0 ? '입실 당일' : '입실일 이후';
  const basis = free ? `결제 후 ${FREE_CANCEL_HOURS}시간 이내 취소` : `${stay.high ? '성수기' : '비수기'} ${stay.weekend ? '주말' : '주중'} · ${when} 취소`;
  return { daysBefore, percent, fee, refund: stay.amount - fee, free, basis };
}

module.exports = {
  DAY, today, addDays, weekdayOf, HOLIDAYS, HOLIDAYS_UNTIL, SEASON_RANGES, SEASON_GUIDE, autoSeason, isWeekendNight,
  REFUND_STEPS, FREE_CANCEL_HOURS, STANDARD_REFUND_TERMS, refundQuote,
};
