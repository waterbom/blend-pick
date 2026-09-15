const money = n => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const day = value => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

function message(reservation, kind) {
  const q = reservation.quote;
  const lines = [
    `[블랜드픽 · 단궁] ${kind === 'confirmed' ? '예약 확정' : '예약 취소 완료'}`,
    `${reservation.buyer_name}님, ${kind === 'confirmed' ? '결제가 완료되어 예약이 확정되었습니다.' : '예약 취소 처리가 완료되었습니다.'}`,
    `예약번호: ${reservation.id}`,
    `입실: ${day(reservation.check_in)} 15:00`,
    `퇴실: ${day(reservation.check_out)} 11:00`,
    `인원: ${reservation.guests}인${q.infants ? ` + 36개월 미만 유아 ${q.infants}명` : ''}`,
    `결제금액: ${money(reservation.amount)}`,
  ];
  if (kind === 'confirmed') {
    if (q.selectedOptions?.bbq ?? q.bbq > 0) lines.push(`바비큐 세팅: ${money(q.bbq)}`);
    if (q.selectedOptions?.monitor ?? q.monitor > 0) lines.push(`64인치 모니터: ${money(q.monitor)}`);
    lines.push(`시설 보증금: ${money(q.depositAmount)} (숙박 결제와 별도)`);
    if (q.depositPaymentNote) lines.push(q.depositPaymentNote);
  } else {
    lines.push(`환불 처리금액: ${money(reservation.refund_amount)}`);
    if (reservation.refund_amount > 0) lines.push('실제 환불 반영 시점은 결제수단에 따라 달라질 수 있습니다.');
    lines.push('계좌이체한 시설 보증금은 숙박 결제 환불과 별도로 확인합니다.');
  }
  lines.push('', '예약번호와 예약자 휴대폰번호로 예약 내역을 확인하세요.',
    'https://shop.blendpunch.com/hotel/dangung/result',
    '문의: 블랜드픽 카카오 상담');
  return lines.join('\n');
}

// Enqueue in the same transaction as the payment/cancellation state change.
async function enqueue(db, reservation, kind) {
  await db.query(`INSERT INTO dangung_notifications(reservation_id,kind,body)
    VALUES($1,$2,$3) ON CONFLICT(reservation_id,kind) DO NOTHING`,
  [reservation.id, kind, message(reservation, kind)]);
}

/** @param {any} pool @param {Function} send @param {{limit?:number,reservationId?:string|null}} [options] */
async function processQueue(pool, send, {limit = 20, reservationId = null} = {}) {
  const counts = {accepted: 0, retry: 0, review: 0, suppressed: 0};
  await pool.query(`UPDATE dangung_notifications SET status='review',last_error='발송 결과 확인 필요',updated_at=NOW()
    WHERE status='sending' AND updated_at < NOW()-INTERVAL '5 minutes'`);
  for (let i = 0; i < limit; i++) {
    const {rows: [job]} = await pool.query(`UPDATE dangung_notifications n
      SET status='sending',attempts=n.attempts+1,updated_at=NOW()
      WHERE n.id=(SELECT q.id FROM dangung_notifications q
        WHERE q.status IN ('pending','retry') AND q.attempts<5 AND q.next_attempt_at<=NOW()
        AND ($1::uuid IS NULL OR q.reservation_id=$1)
        ORDER BY q.next_attempt_at,q.id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING n.*`, [reservationId]);
    if (!job) break;
    const {rows: [r]} = await pool.query('SELECT buyer_phone,status FROM dangung_reservations WHERE id=$1', [job.reservation_id]);
    if (!r || (job.kind === 'confirmed' && r.status !== 'paid') || (job.kind === 'cancelled' && r.status !== 'cancelled')) {
      await pool.query("UPDATE dangung_notifications SET status='suppressed',body='',updated_at=NOW() WHERE id=$1", [job.id]);
      counts.suppressed++;
      continue;
    }
    let result;
    try { result = await send(r.buyer_phone, job.body, job.kind === 'confirmed' ? '단궁 예약 확정' : '단궁 예약 취소'); }
    catch { result = {ok: false, outcome: 'unknown'}; }
    // A gateway timeout can happen after acceptance: never automatically duplicate it.
    const status = result.ok ? 'accepted' : result.outcome === 'rejected' && job.attempts < 5 ? 'retry' : 'review';
    await pool.query(`UPDATE dangung_notifications SET status=$2,
      last_error=$3,body=CASE WHEN $2='accepted' THEN '' ELSE body END,
      next_attempt_at=NOW()+($4::int * INTERVAL '15 minutes'),updated_at=NOW() WHERE id=$1`,
    [job.id, status, status === 'accepted' ? null : status === 'retry' ? '발송 거절 · 자동 재시도 대기' : '발송 결과 또는 설정 확인 필요', Math.min(16, 2 ** (job.attempts - 1))]);
    counts[status]++;
  }
  return counts;
}

module.exports = {message, enqueue, processQueue};
