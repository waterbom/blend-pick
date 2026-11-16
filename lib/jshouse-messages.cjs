// JS하우스 예약 문자 문구 — 손님용(접수·확정·거절·취소)과 운영자용(새 신청·취소 요청).
// 요금·주소·입실 시간은 관리자에서 입력한 값이 있을 때만 넣는다 (없는 정보를 지어내지 않는다).
const SITE = 'https://shop.blendpunch.com';
const money = n => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const day = value => (typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10));
const nightsOf = r => Math.round((Date.parse(day(r.check_out)) - Date.parse(day(r.check_in))) / 86400000);

function stayLines(r) {
  const lines = [
    `예약번호: ${r.code}`,
    `일정: ${day(r.check_in)} ~ ${day(r.check_out)} (${nightsOf(r)}박)`,
    `인원: ${r.guests}명`,
  ];
  if (typeof r.estimate?.total === 'number') lines.push(`예상 숙박요금: ${money(r.estimate.total)}`);
  return lines;
}

/** @param {any} r @param {'requested'|'confirmed'|'declined'|'cancelled'} kind @param {any} [config] */
function guestMessage(r, kind, config = {}) {
  const head = { requested: '예약 신청 접수', confirmed: '예약 확정', declined: '예약 불가 안내', cancelled: '예약 취소 완료' }[kind];
  const lines = [`[JS하우스 · 블랜드픽] ${head}`];
  if (kind === 'requested') {
    lines.push(`${r.guest_name}님, 예약 신청이 접수되었습니다.`, ...stayLines(r), '',
      '일정을 확인한 뒤 확정 여부와 결제 방법을 문자로 안내드립니다. 아직 예약이 확정된 것은 아닙니다.');
  } else if (kind === 'confirmed') {
    lines.push(`${r.guest_name}님, 예약이 확정되었습니다.`, ...stayLines(r));
    if (config.checkInTime || config.checkOutTime) lines.push(`입실 ${config.checkInTime || '별도 안내'} · 퇴실 ${config.checkOutTime || '별도 안내'}`);
    if (config.address) lines.push(`주소: ${config.address}`);
    lines.push('', '결제와 입실 방법은 이어서 안내드립니다.');
  } else if (kind === 'declined') {
    lines.push(`${r.guest_name}님, 죄송합니다. 신청하신 일정은 예약이 어렵습니다.`, ...stayLines(r), '', '다른 날짜로 다시 신청해 주시면 빠르게 확인하겠습니다.');
  } else {
    lines.push(`${r.guest_name}님, 예약이 취소되었습니다.`, ...stayLines(r));
  }
  lines.push('', '예약 조회', `${SITE}/hotel/jshouse#lookup`);
  return lines.join('\n');
}

/** @param {any} r @param {'requested'|'cancel_requested'|'guest_cancelled'} kind */
function operatorMessage(r, kind) {
  const head = { requested: '새 예약 신청', cancel_requested: '확정 예약 취소 요청', guest_cancelled: '손님이 신청을 취소함' }[kind];
  const lines = [`[JS하우스 관리] ${head}`, `${r.guest_name} / ${r.guest_phone}`, ...stayLines(r)];
  if (r.memo) lines.push(`요청: ${r.memo}`);
  if (kind !== 'guest_cancelled') lines.push('', '확인·처리', `${SITE}/admin/jshouse`);
  return lines.join('\n');
}

module.exports = { guestMessage, operatorMessage };
