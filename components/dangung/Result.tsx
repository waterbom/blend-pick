'use client';
import {useEffect, useRef, useState} from 'react';
import {bookingApi, money} from './Booking';

const labels: Record<string, string> = {
  pending: '결제 대기', confirming: '결제 확인 중', paid: '예약 확정',
  expired: '결제 시간 만료', cancelled: '예약 취소 완료', cancelling: '환불 확인 중',
};

export default function DangungResult() {
  const [order, setOrder] = useState<any>(null);
  const [id, setId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState(false);
  const [retryCallback, setRetryCallback] = useState(false);
  const running = useRef(false);

  function show(data: any, completed = false) {
    setRetryCallback(false); setOrder(data); setId(data.id); setCompletion(completed && data.status === 'paid');
    history.replaceState(null, '', `/hotel/dangung/result?orderId=${encodeURIComponent(data.id)}`);
  }

  async function check(initial = false) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const params = new URLSearchParams(location.search);
      const target = initial ? params.get('orderId') || params.get('reservationId') : id;
      if (!target) return;
      setId(target);
      let data;
      if (initial && params.get('failed') === '1') {
        data = await bookingApi({action: 'abandon', orderId: target});
      } else if (initial && params.has('paymentKey') && params.has('amount')) {
        data = await bookingApi({action: 'confirm', orderId: target, paymentKey: params.get('paymentKey'), amount: Number(params.get('amount'))});
      } else {
        const response = await fetch(`/api/dangung?id=${encodeURIComponent(target)}`, {cache: 'no-store'});
        data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (['confirming', 'cancelling'].includes(data.status)) data = await bookingApi({action: 'reconcile', orderId: target});
      }
      show(data, initial && (params.has('paymentKey') || data.status === 'paid'));
    } catch (e) {
      setRetryCallback(true); setError((e as Error).message);
    } finally { running.current = false; setBusy(false); }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const data = await bookingApi({action: 'lookup', orderId: id.trim(), phone});
      show(data); setPhone('');
    } catch (e) { setError((e as Error).message); }
    finally { running.current = false; setBusy(false); }
  }

  async function requestCancel() {
    if (running.current || !order || order.cancelRequested) return;
    if (!confirm('예약 취소를 요청하시겠어요? 관리자가 환불 규정을 확인한 후 취소·환불을 처리합니다.')) return;
    running.current = true; setBusy(true); setError('');
    try { show(await bookingApi({action: 'cancelRequest', orderId: order.id})); }
    catch (e) { setError((e as Error).message); }
    finally { running.current = false; setBusy(false); }
  }

  useEffect(() => { check(true); }, []);

  return <main className="dg-result">
    <a href="/hotel/dangung">← 단궁 페이지</a>
    <h1>{completion ? '결제가 완료되었습니다' : order ? labels[order.status] : '단궁 예약 확인'}</h1>
    {error && <p className="booking-error" role="alert">{error}</p>}
    {retryCallback && !order && <button className="booking-primary" disabled={busy} onClick={() => check(true)}>결제 상태 다시 확인 ↻</button>}
    {busy && <p role="status">예약 정보를 확인하고 있습니다…</p>}
    {completion && order ? <section className="dg-payment-success" aria-label="결제 완료">
      <p>단궁 예약이 확정되었습니다.</p>
      <p>{order.checkIn} → {order.checkOut} · {order.guests}인{order.infants > 0 ? ` + 유아 ${order.infants}명` : ''}</p>
      <p>결제 금액 <strong>{money(order.amount)}</strong></p>
      <p>예약번호 <b className="dg-order-id">{order.id}</b></p>
      <p>예약번호를 보관해 주세요. 이후에는 예약번호와 예약자 휴대폰번호로 조회할 수 있습니다.</p>
      <button className="booking-primary" onClick={() => setCompletion(false)}>예약내역 확인하기 →</button>
    </section> : order ? <section aria-label="예약 상세 내역">
      <p>예약번호 <b className="dg-order-id">{order.id}</b></p>
      <p>{order.checkIn} 15:00 → {order.checkOut} 11:00 · {order.guests}인{order.infants > 0 ? ` + 36개월 미만 유아 ${order.infants}명 (무료)` : ''}</p>
      <p>{order.buyerName}님 · 결제 금액 <strong>{money(order.amount)}</strong></p>
      <dl className="dg-result-amounts">
        <div><dt>숙박료</dt><dd>{money(order.quote.lodging)}</dd></div>
        <div><dt>추가 인원</dt><dd>{money(order.quote.extra)}</dd></div>
        <div><dt>바비큐 세팅</dt><dd>{(order.quote.selectedOptions?.bbq ?? order.quote.bbq > 0) ? money(order.quote.bbq) : '미선택'}</dd></div>
        <div><dt>64인치 모니터</dt><dd>{(order.quote.selectedOptions?.monitor ?? order.quote.monitor > 0) ? money(order.quote.monitor) : '미선택'}</dd></div>
      </dl>
      {order.status === 'paid' && <>
        {order.receiptUrl && <a href={order.receiptUrl} target="_blank" rel="noopener noreferrer">결제 영수증 보기 ↗</a>}
        <p>시설 보증금 {money(order.quote.depositAmount)} (숙박 결제금액에 미포함)</p>
        <p className="dg-preline">{order.quote.depositPaymentNote}</p>
        {order.cancelRequested && <p role="status">취소 요청이 접수되었습니다. 관리자가 규정을 확인한 후 처리하며, 현재 예약은 아직 취소 완료 상태가 아닙니다.</p>}
        <button className="text-button" disabled={busy || order.cancelRequested} onClick={requestCancel}>{order.cancelRequested ? '취소 요청 접수됨' : '예약 취소 요청하기'}</button>
      </>}
      <details><summary>예약 시 동의한 취소·환불 규정</summary><p className="dg-preline">{order.quote.refundTerms}</p></details>
      <details><summary>시설 보증금 규정</summary><p className="dg-preline">{order.quote.depositTerms}</p></details>
      {['confirming', 'cancelling'].includes(order.status) && <p>결제·환불 상태를 확인 중입니다. 다시 결제하지 마시고 아래 상태 다시 확인 또는 고객센터를 이용해 주세요.</p>}
      {order.status === 'cancelled' && <p>환불 처리금액: {money(order.refundAmount ?? 0)}. 계좌이체한 시설 보증금은 별도 확인합니다.</p>}
      {['pending', 'expired'].includes(order.status) && <a href="/hotel/dangung#booking">날짜 다시 선택하기 →</a>}
      <button className="booking-primary" disabled={busy} onClick={() => check()}>상태 다시 확인 ↻</button>
      <button className="text-button" disabled={busy} onClick={() => {setOrder(null); setError(''); setId(''); history.replaceState(null, '', '/hotel/dangung/result');}}>다른 예약 조회</button>
    </section> : <form onSubmit={lookup} className="dg-lookup-form">
      <p>예약번호와 예약 시 입력한 휴대폰번호로 확인해 주세요.</p>
      <fieldset disabled={busy}>
        <label>예약번호<input required className="dg-order-id" maxLength={36} value={id} onChange={e => setId(e.target.value)} autoComplete="off" placeholder="예약번호 입력" /></label>
        <label>예약자 휴대폰번호<input required type="tel" inputMode="tel" autoComplete="tel" pattern="01[016789][0-9]{7,8}" maxLength={11} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="01012345678" /></label>
        <button className="booking-primary" type="submit">예약내역 확인하기 →</button>
      </fieldset>
      <p className="booking-small">다른 기기에서도 조회할 수 있습니다. 예약번호는 예약 확정 문자에서도 확인할 수 있어요.</p>
    </form>}
    <p><a href="http://pf.kakao.com/_VyING/chat" target="_blank" rel="noopener noreferrer">예약 문의 · 카카오 상담 ↗</a></p>
  </main>;
}
