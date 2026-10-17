'use client';
import { useRef,useState } from 'react';
import { commerceParams } from '@/lib/analytics';
import { useMetaEvent } from '@/lib/use-meta-event';
import BookingCalendar from './Calendar';
import PaymentSummary from './PaymentSummary';
import { startingPrice, useDangungAvailability } from './Availability';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import RoomSlideshow from '@/components/dangung/RoomSlideshow';
export const money=(n:number)=>`${n.toLocaleString('ko-KR')}원`;
export async function bookingApi(input:object){const r=await fetch('/api/dangung',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const data=await r.json();if(!r.ok)throw Error(data.error||'예약 처리에 실패했습니다.');return data;}
const dayKey=(d:Date)=>d.toISOString().slice(0,10);
const addDay=(d:string,n:number)=>dayKey(new Date(Date.parse(d)+n*86400000));
type Quote={version:number;checkIn:string;checkOut:string;guests:number;infants:number;nightly:{day:string;price:number;season:string}[];lodging:number;extra:number;bbq:number;monitor:number;depositPaymentNote:string;total:number;depositAmount:number;depositTerms:string;refundTerms:string};
export default function DangungBooking({clientKey}:{clientKey:string}){
 const {calendar,loadError,refresh}=useDangungAvailability();
 const [error,setError]=useState(''),[month,setMonth]=useState(0),[checkIn,setIn]=useState(''),[checkOut,setOut]=useState(''),[guests,setGuests]=useState(6),[bbq,setBbq]=useState(false),[monitor,setMonitor]=useState(false),[infants,setInfants]=useState(0),[buyerName,setName]=useState(''),[buyerPhone,setPhone]=useState(''),[memo,setMemo]=useState(''),[quote,setQuote]=useState<Quote|null>(null),[busy,setBusy]=useState(false),[agree,setAgree]=useState(false),[code,setCode]=useState(''),[verified,setVerified]=useState(false),[notice,setNotice]=useState(''),[reviewStep,setReviewStep]=useState<'terms'|'confirm'>('terms');
 const datePicker=useRef<HTMLDialogElement>(null),review=useRef<HTMLDialogElement>(null),requestId=useRef(''),pending=useRef(false);
 const selling=!!(calendar?.config.enabled&&calendar.paymentReady);
 useMetaEvent('ViewContent','hotel-dangung',{content_type:'product',content_ids:['hotel-dangung']});
 useMetaEvent('InitiateCheckout','hotel-dangung',commerceParams([{id:'hotel-dangung',quantity:1,price:quote?.total??0}]),!!quote);
 const available=(day:string)=>selling&&day>=addDay(calendar!.today,calendar!.config.minLeadDays)&&calendar!.dates.some(d=>d.day===day&&d.available&&!d.occupied);
 function canOut(day:string){if(!checkIn||day<=checkIn||!calendar)return false;const count=(Date.parse(day)-Date.parse(checkIn))/86400000;return count<=calendar.config.maxNights&&Array.from({length:count},(_,i)=>addDay(checkIn,i)).every(available);}
 function choose(day:string){setQuote(null);setError('');requestId.current='';if(checkIn&&!checkOut&&day>checkIn){if(canOut(day))setOut(day);else setError('기간 중 마감된 날짜가 있습니다. 다른 입실일을 선택해 주세요.');}else{setIn(day);setOut('');}}
 async function phone(action:'send'|'confirm'){setBusy(true);setError('');try{const r=await fetch(action==='send'?'/api/verify/phone':'/api/verify/phone/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:buyerPhone,code})});const d=await r.json();if(!r.ok)throw Error(d.error);if(action==='confirm')setVerified(true);setNotice(action==='send'?'인증번호를 보냈습니다.':'휴대폰 인증이 완료되었습니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function reviewBooking(e:React.FormEvent){e.preventDefault();if(pending.current)return;setError('');if(!checkIn||!checkOut){setError('입실일과 퇴실일을 선택해 주세요.');datePicker.current?.showModal();return;}setBusy(true);try{const q=await bookingApi({action:'quote',checkIn,checkOut,guests,infants,bbq,monitor});setQuote(q);setAgree(false);}catch(e){setError((e as Error).message);await refresh().catch(()=>{});}finally{setBusy(false);}}
 async function pay(){if(pending.current||!quote||!agree)return;if(calendar?.phoneVerify&&!verified){setError('휴대폰 인증을 완료해 주세요.');return;}pending.current=true;setBusy(true);setError('');let reservation:any;
 try{requestId.current||=crypto.randomUUID();reservation=await bookingApi({action:'reserve',requestId:requestId.current,checkIn,checkOut,guests,infants,bbq,monitor,buyerName,buyerPhone,memo,version:quote.version,amount:quote.total,agreed:true});
 if(reservation.status!=='pending'){location.assign(`/hotel/dangung/result?orderId=${reservation.id}`);return;}
 sessionStorage.setItem('dangung-last-reservation',reservation.id);
 const toss=await loadTossPayments(clientKey);await toss.payment({customerKey:'ANONYMOUS'}).requestPayment({method:'CARD',amount:{currency:'KRW',value:reservation.amount},orderId:reservation.id,orderName:`단궁 독채 숙박 ${reservation.checkIn} ~ ${reservation.checkOut}`,customerName:buyerName,customerMobilePhone:buyerPhone,successUrl:`${location.origin}/hotel/dangung/result`,failUrl:`${location.origin}/hotel/dangung/result?failed=1&reservationId=${reservation.id}`});
 }catch(e){const err=e as Error&{code?:string};if(reservation?.id&&['USER_CANCEL','PAY_PROCESS_CANCELED','PAY_PROCESS_ABORTED'].includes(err.code||'')){await bookingApi({action:'abandon',orderId:reservation.id}).catch(()=>{});requestId.current='';setError('결제를 취소했습니다. 날짜를 다시 확인하고 예약할 수 있어요.');}else setError(err.message||'결제 진행 상태를 확인해 주세요.');review.current?.close();await refresh().catch(()=>{});}finally{pending.current=false;setBusy(false);}}
 const current=calendar?new Date(`${calendar.today.slice(0,7)}-01T00:00:00Z`):new Date('2026-01-01T00:00:00Z');current.setUTCMonth(current.getUTCMonth()+month);

 const price=startingPrice(calendar);
 const nights=checkIn&&checkOut?(Date.parse(checkOut)-Date.parse(checkIn))/86400000:0;
 return <section id="booking" className="booking-section dg-booking-live" aria-labelledby="booking-heading">
  <div className="dgs-booking-panel">
   <div className="dgs-booking-heading"><span className="dgs-kicker">YOUR STAY AT DANGUNG</span><h2 id="booking-heading" tabIndex={-1}>객실 선택</h2></div>
   <div className="dgs-booking-room"><RoomSlideshow compact/><div><h3>단궁 독채</h3><p>기준 6인 / 최대 16인</p><span>한옥 독채 · 1개 타입</span></div></div>
   <div className="dgs-booking-rate" aria-live="polite">{price!==null?<><strong>{money(price)}</strong><span>부터 / 1박</span></>:<p>{loadError?'예약 정보를 다시 불러와 주세요.':!calendar?'예약 정보를 확인하고 있습니다.':selling?'현재 예약 가능한 날짜가 없습니다.':'예약 오픈 준비 중입니다.'}</p>}<small>추가 인원·옵션·시설 보증금 별도</small></div>
   {(error||loadError)&&<p className="booking-error" role="alert">{error||loadError} <button type="button" disabled={busy} onClick={()=>{setError('');refresh().catch(e=>setError(e.message));}}>다시 불러오기 ↻</button></p>}
   <form className="booking-form dgs-booking-form" onSubmit={reviewBooking}>
    <fieldset disabled={busy||!selling}>
     <legend className="dgs-sr-only">예약 날짜, 인원과 옵션 선택</legend>
     <button type="button" className="dgs-date-trigger" aria-haspopup="dialog" aria-controls="dangung-date-picker" onClick={()=>datePicker.current?.showModal()}>
      <span><small>체크인</small><strong>{checkIn?checkIn.replaceAll('-', '.'):'날짜 선택'}</strong></span><i aria-hidden="true">→</i><span><small>체크아웃</small><strong>{checkOut?checkOut.replaceAll('-', '.'):'날짜 선택'}</strong></span>
     </button>
     <p className="dgs-date-caption">{nights?`${nights}박 ${nights+1}일 · `:''}입실 15:00 · 퇴실 11:00</p>
     <div className="dg-guest-grid"><label>이용 인원 <small>36개월 이상</small><select value={guests} onChange={e=>{setGuests(Number(e.target.value));setQuote(null);requestId.current='';}}>{Array.from({length:16},(_,i)=><option key={i} value={i+1}>{i+1}인</option>)}</select></label><label>유아 <small>36개월 미만 · 무료</small><input aria-label="36개월 미만 유아 인원" type="number" min={0} max={99} step={1} value={infants} onChange={e=>{setInfants(Number(e.target.value));setQuote(null);requestId.current='';}}/></label></div>
     <p className="booking-small dgs-guest-note">36개월 미만 유아는 기준·최대 인원에서 제외됩니다.{selling&&<><br/>6인 초과 1인 {money(calendar!.config.extraGuestFee)} / {calendar!.config.extraGuestUnit==='perNight'?'1박':'예약'} · 침구 포함</>}</p>
     <details className="dgs-booking-extras"><summary>선택 옵션 <span>{[bbq&&'바비큐',monitor&&'모니터'].filter(Boolean).join(' · ')||'선택 안 함'}</span></summary>
      <label className="dg-check dgs-booking-option"><input type="checkbox" checked={bbq} onChange={e=>{setBbq(e.target.checked);setQuote(null);requestId.current='';}}/><span><b>바비큐 세팅</b><small>예약당 1회</small></span><strong>{calendar?money(calendar.config.bbqFee):'요금 확인 중'}</strong></label>
      <label className="dg-check dgs-booking-option"><input type="checkbox" checked={monitor} onChange={e=>{setMonitor(e.target.checked);setQuote(null);requestId.current='';}}/><span><b>64인치 모니터</b><small>예약당 1회</small></span><strong>{calendar?money(calendar.config.monitorFee):'요금 확인 중'}</strong></label>
     </details>
     <button className="booking-primary" type="submit">{busy?'요금 확인 중…':quote?'선택한 일정 요금 다시 확인':'최종 가격 확인'}</button>
    </fieldset>
    {quote?<div className="dg-total-review" aria-live="polite"><h3 className="dg-review-label">선택한 일정의 결제금액</h3><PaymentSummary quote={quote}/><button className="booking-primary" type="button" disabled={busy} onClick={()=>{setAgree(false);setError('');setReviewStep('terms');review.current?.showModal();}}>환불규정 확인하고 예약하기</button></div>:<p className="dg-before-pay">날짜·인원 선택 후 최종 요금을 확인해 주세요.<br/>환불규정 확인 후 결제를 진행합니다.</p>}
   </form>
   {!selling&&calendar&&<p className="dg-closed">현재 예약 결제는 오픈 준비 중입니다.<br/>숙박·촬영대관은 <a href="http://pf.kakao.com/_VyING/chat" target="_blank" rel="noopener noreferrer">카카오 상담 ↗</a>으로 문의해 주세요.</p>}
   <div className="dgs-booking-links"><a href="/hotel/dangung/result">내 예약 확인</a><a href="http://pf.kakao.com/_VyING/chat" target="_blank" rel="noopener noreferrer">예약 문의 ↗</a></div>
  </div>
  <dialog ref={datePicker} id="dangung-date-picker" className="booking-dialog dgs-calendar-dialog" aria-label="단궁 예약 날짜 선택" onCancel={e=>{if(busy)e.preventDefault();}} onClick={e=>{if(e.target===e.currentTarget&&!busy)e.currentTarget.close();}}>
   <button type="button" disabled={busy} className="dialog-close" aria-label="날짜 선택 닫기" onClick={()=>datePicker.current?.close()}>×</button>
   <BookingCalendar current={current} today={calendar?.today} dates={calendar?.dates||[]} month={month} busy={busy} selling={selling} checkIn={checkIn} checkOut={checkOut} available={available} canOut={canOut} onChoose={choose} onMonth={delta=>setMonth(m=>m+delta)} onReset={()=>{setIn('');setOut('');setQuote(null);requestId.current='';}}/>
   {error&&<p className="booking-error" role="alert">{error}</p>}
   <button type="button" className="booking-primary" disabled={!checkIn||!checkOut||busy} onClick={()=>datePicker.current?.close()}>{nights?`${nights}박 일정 적용`:'입실일·퇴실일을 선택해 주세요'}</button>
  </dialog>
 <dialog ref={review} className="booking-dialog dg-checkout-dialog" aria-labelledby="dg-review-title" onCancel={e=>{if(busy)e.preventDefault();}}>
 <button type="button" disabled={busy} className="dialog-close" aria-label="예약 확인 닫기" onClick={()=>review.current?.close()}>×</button>
 <div className="dg-review-header"><span className="dg-calendar-eyebrow">A DAY TO REMEMBER</span><h2 id="dg-review-title">{reviewStep==='terms'?'환불규정·보증금 확인':'결제 최종 내역 확인'}</h2><div className="dg-review-progress"><span className={reviewStep==='terms'?'is-current':'is-done'}>01 규정 확인</span><i aria-hidden="true">→</i><span className={reviewStep==='confirm'?'is-current':''}>02 내역 확인 · 결제</span></div></div>
 {error&&<p role="alert" className="booking-error">{error}</p>}
 {quote&&reviewStep==='terms'&&<>
 <section className="dg-policy-card"><h3><span>01</span>취소 및 환불 규정</h3><p className="dg-preline">{quote.refundTerms}</p></section>
 <section className="dg-policy-card"><h3><span>02</span>시설 보증금 · {money(quote.depositAmount)}</h3><p className="dg-preline">{quote.depositTerms}</p><p className="dg-deposit-payment">{quote.depositPaymentNote}</p></section>
 <label className={`dg-check dg-consent ${agree?'is-agreed':''}`}><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>취소·환불 규정과 시설 보증금 별도 납부 조건을 확인하고 동의합니다.</label>
 <button className="booking-primary" type="button" disabled={!agree} onClick={()=>{setError('');setReviewStep('confirm');}}>결제 진행 →</button>
 <p className="booking-small">다음 화면에서 예약자 정보와 결제 내역을 최종 확인합니다.</p>
 </>}
 {quote&&reviewStep==='confirm'&&<form onSubmit={e=>{e.preventDefault();pay();}}><fieldset disabled={busy}>
 <PaymentSummary quote={quote}/><details className="dg-nightly-detail"><summary>날짜별 숙박료 자세히 보기</summary><ul className="nightly-list">{quote.nightly.map(d=><li key={d.day}><span>{d.day} · {d.season}</span><b>{money(d.price)}</b></li>)}</ul></details><h3 className="dg-buyer-heading">예약자 정보 <span>예약 안내 문자를 보내드려요</span></h3>
 <div className="buyer-row"><label>예약자명<input required minLength={2} maxLength={40} autoComplete="name" value={buyerName} onChange={e=>{setName(e.target.value);requestId.current='';}}/></label><label>휴대폰 번호<input required type="tel" inputMode="tel" autoComplete="tel" pattern="01[016789][0-9]{7,8}" maxLength={11} placeholder="01012345678" value={buyerPhone} onChange={e=>{setPhone(e.target.value.replace(/\D/g,''));setVerified(false);requestId.current='';}}/></label></div>{calendar?.phoneVerify&&<div className="dg-verify"><button type="button" onClick={()=>phone('send')}>인증번호 받기</button><label>인증번호<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label><button type="button" onClick={()=>phone('confirm')}>{verified?'인증 완료':'인증 확인'}</button></div>}<label>요청사항 (선택)<textarea rows={2} maxLength={300} value={memo} onChange={e=>{setMemo(e.target.value);requestId.current='';}}/></label>
 {notice&&<p role="status">{notice}</p>}
 <label className="dg-check dg-consent"><input type="checkbox" required/>예약 처리에 필요한 이름·휴대폰번호 수집에 동의합니다. <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침 ↗</a></label>
 <div className="dg-payment-actions"><button className="booking-primary" disabled={!agree||busy} type="submit">{busy?'결제창 연결 중…':`${money(quote.total)} 결제하기 →`}</button>
 <button className="text-button" type="button" disabled={busy} onClick={()=>setReviewStep('terms')}>← 환불규정·보증금 다시 확인</button>
 <p className="booking-small">결제 승인 완료 후 예약이 확정됩니다. 결제 진행 중에는 최대 15분간 날짜를 확보합니다.</p></div>
 </fieldset></form>}
 </dialog>

 </section>;
}
