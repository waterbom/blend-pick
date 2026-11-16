"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackPurchase } from "@/lib/analytics";
import { JSH_PATH, KAKAO_URL } from "@/components/jshouse/content";
import { STATUS, shortDate, stayApi, won, type StayOrder } from "@/components/jshouse/stay";

// 카드 결제 결과 화면 — 토스 결제창에서 돌아오는 곳.
//  · 결제 성공(?paymentKey&orderId&amount): 서버에서 승인하고 예약 확정을 보여 준다.
//  · 결제 실패·취소(?failed=1&booking=주문번호): 잡아 둔 날짜를 바로 돌려준다.
//  · 다시 열었을 때(?orderId): 현재 상태를 보여 주고, 승인·환불 확인 중이면 결제 기록과 다시 맞춘다.
// 주소창의 결제 값은 처리 후 바로 지워서 새로고침해도 다시 승인 요청을 보내지 않는다.

const HEADING: Record<string, string> = {
  confirmed: "예약이 확정됐어요", confirming: "결제를 확인하고 있어요", pending: "아직 결제가 끝나지 않았어요",
  expired: "결제가 완료되지 않았어요", cancelling: "환불을 처리하고 있어요", cancelled: "예약이 취소됐어요",
  requested: "예약 신청이 접수됐어요", declined: "예약이 어려운 일정이에요",
};

function load(initial: boolean): Promise<StayOrder | null> {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("orderId") || params.get("booking") || "";
  if (!id) return Promise.resolve(null);
  if (initial && params.get("failed") === "1") return stayApi<StayOrder>({ action: "abandon", orderId: id });
  if (initial && params.has("paymentKey") && params.has("amount")) {
    return stayApi<StayOrder>({ action: "confirm", orderId: id, paymentKey: params.get("paymentKey"), amount: Number(params.get("amount")) });
  }
  return fetch(`/api/jshouse?order=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || "예약 정보를 불러오지 못했어요.");
    return ["confirming", "cancelling"].includes(data.booking?.status) ? stayApi<StayOrder>({ action: "reconcile", orderId: id }) : (data as StayOrder);
  });
}

export default function StayResult() {
  const [order, setOrder] = useState<StayOrder | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(true), [empty, setEmpty] = useState(false);
  const [copied, setCopied] = useState(false), [unpaid, setUnpaid] = useState(false);
  const running = useRef(false);

  const settle = useCallback((initial: boolean) => {
    if (running.current) return;
    running.current = true;
    const params = new URLSearchParams(window.location.search);
    const justPaid = initial && params.has("paymentKey"), failedReturn = initial && params.get("failed") === "1";
    load(initial).then(data => {
      if (!data) { setEmpty(true); return; }
      setOrder(data); setError("");
      window.history.replaceState(null, "", `${JSH_PATH}/result?orderId=${encodeURIComponent(data.orderId)}`);
      // 구매 이벤트는 서버가 승인한 금액으로, 방금 결제한 브라우저에서 한 번만 보낸다
      let recent = justPaid;
      try { recent ||= window.sessionStorage.getItem("jshouse-last-order") === data.orderId; } catch { /* 저장소 없이도 동작 */ }
      if (recent && data.booking.status === "confirmed" && data.booking.paid && typeof data.booking.amount === "number") {
        trackPurchase("jshouse", data.orderId, data.booking.amount, [{ id: "hotel-jshouse", quantity: 1, price: data.booking.amount }]);
      }
    }).catch(e => {
      // 결제 실패로 돌아온 경우에는 예약을 못 찾아도 승인된 결제가 없다 (잡아 둔 날짜는 15분 안에 자동으로 열린다)
      if (failedReturn) setUnpaid(true); else setError((e as Error).message);
    }).finally(() => { running.current = false; setBusy(false); });
  }, []);
  useEffect(() => { settle(true); }, [settle]);
  const retry = () => { setBusy(true); setError(""); settle(!order); };

  const booking = order?.booking, status = booking?.status;
  const good = status === "confirmed";
  return <main className="jsh-result">
    <a className="jsh-result-brand" href={JSH_PATH} aria-label="JS하우스 페이지로 돌아가기">JS HOUSE<span>연남</span></a>
    <div className="jsh-result-card" aria-live="polite">
      {booking && status ? <>
        {good
          ? <svg className="jsh-done-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="m20 33 9 9 16-19" /></svg>
          : <span className="jsh-result-chip" data-status={status}>{STATUS[status]}</span>}
        <h1>{HEADING[status]}</h1>
        {status === "confirmed" && <p>{booking.paid ? "결제가 완료되어 예약이 확정됐습니다. 확정 문자를 함께 보내드렸어요." : "예약이 확정됐습니다."}</p>}
        {status === "confirming" && <p>결제 승인 결과를 아직 받지 못했어요. <b>다시 결제하지 마시고</b> 아래 버튼으로 상태를 다시 확인해 주세요.</p>}
        {status === "pending" && <p>결제창에서 결제를 끝내지 않았어요. 결제된 금액은 없습니다. 날짜는 15분 동안만 잡혀 있어요.</p>}
        {status === "expired" && <p>결제가 승인되지 않아 예약되지 않았어요. <b>결제된 금액은 없습니다.</b> 날짜를 다시 골라 주세요.</p>}
        {status === "cancelling" && <p>환불 처리 결과를 확인하고 있어요. 잠시 뒤 다시 확인해 주세요.</p>}
        {status === "cancelled" && <p>예약이 취소됐습니다.{typeof booking.amount === "number" && booking.refundAmount !== null ? ` 환불 처리금액은 ${won(booking.refundAmount)}이에요.` : ""}</p>}
        {status !== "expired" && status !== "pending" && <div className="jsh-done-code">
          <small>예약번호</small><strong>{booking.code}</strong>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(booking.code).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "복사했어요" : "번호 복사"}</button>
        </div>}
        <dl>
          <div><dt>일정</dt><dd>{shortDate(booking.checkIn)} → {shortDate(booking.checkOut)} · {booking.nights}박</dd></div>
          <div><dt>인원</dt><dd>{booking.guests}명</dd></div>
          <div><dt>예약자</dt><dd>{booking.guestName}</dd></div>
          {typeof booking.amount === "number" && status !== "expired" && <div><dt>{booking.paid ? "결제금액" : "결제 예정 금액"}</dt><dd>{won(booking.amount)}</dd></div>}
        </dl>
        {booking.paid && booking.receiptUrl && <a className="jsh-result-link" href={booking.receiptUrl} target="_blank" rel="noopener noreferrer">결제 영수증 보기 ↗</a>}
        {booking.estimate?.refundTerms && status !== "expired" && <details className="jsh-status-terms"><summary>동의한 취소·환불 규정</summary><p>{booking.estimate.refundTerms}</p></details>}
        {good && <p className="jsh-done-note">예약번호를 보관해 주세요. 예약번호와 휴대폰 번호로 언제든 조회하고, 취소도 요청할 수 있어요.</p>}
      </> : busy ? <>
        <span className="jsh-result-spin" aria-hidden="true" />
        <h1>결제를 확인하고 있어요</h1>
        <p>창을 닫지 말고 잠시만 기다려 주세요.</p>
      </> : unpaid ? <>
        <span className="jsh-result-chip" data-status="expired">{STATUS.expired}</span>
        <h1>{HEADING.expired}</h1>
        <p>결제가 승인되지 않아 예약되지 않았어요. <b>결제된 금액은 없습니다.</b> 날짜를 다시 골라 주세요.</p>
      </> : <>
        <h1>{empty ? "확인할 예약이 없어요" : "예약을 확인하지 못했어요"}</h1>
        <p>{empty ? "예약번호와 휴대폰 번호로 예약을 조회할 수 있어요." : "결제가 진행됐을 수 있어요. 다시 결제하지 마시고 상태를 다시 확인해 주세요."}</p>
      </>}
      {error && <p className="jsh-form-error" role="alert">{error}</p>}
      <div className="jsh-result-actions">
        {(error || status === "confirming" || status === "cancelling") && <button type="button" className="jsh-btn jsh-btn-dark jsh-btn-block" disabled={busy} onClick={retry}>{busy ? "확인하는 중…" : "결제 상태 다시 확인"}</button>}
        {(status === "expired" || status === "pending" || (unpaid && !order)) && <a className="jsh-btn jsh-btn-dark jsh-btn-block" href={`${JSH_PATH}#reserve`}>날짜 다시 고르기</a>}
        {good && <a className="jsh-btn jsh-btn-dark jsh-btn-block" href={JSH_PATH}>JS하우스로 돌아가기</a>}
        {!busy && <a className="jsh-btn jsh-btn-line jsh-btn-block" href={`${JSH_PATH}#lookup`}>예약번호로 조회·취소 요청</a>}
      </div>
    </div>
    <p className="jsh-result-help">도움이 필요하면 블랜드픽 <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">카카오 상담</a>으로 예약번호와 함께 문의해 주세요.</p>
  </main>;
}
