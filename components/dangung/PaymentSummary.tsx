type Quote={checkIn:string;checkOut:string;guests:number;infants:number;nightly:{day:string;price:number;season:string}[];lodging:number;extra:number;bbq:number;monitor:number;total:number;depositAmount:number};
const won=(n:number)=>`${n.toLocaleString('ko-KR')}원`;
export default function PaymentSummary({quote}:{quote:Quote}){
 return <div className="dg-payment-summary">
  <div className="dg-summary-stay"><div><span>DANGUNG · PRIVATE STAY</span><h3>우리만의 단궁, {quote.nightly.length}박</h3></div><b>{quote.guests}인{quote.infants?` + 유아 ${quote.infants}명`:''}</b></div>
  <div className="dg-summary-dates"><span>{quote.checkIn}<small>입실 15:00</small></span><i aria-hidden="true">→</i><span>{quote.checkOut}<small>퇴실 11:00</small></span></div>
  <dl className="dg-quote"><div><dt>숙박료 <small>{quote.nightly.length}박</small></dt><dd>{won(quote.lodging)}</dd></div><div><dt>추가 인원</dt><dd>{won(quote.extra)}</dd></div><div><dt>바비큐 세팅</dt><dd>{quote.bbq?won(quote.bbq):'미선택'}</dd></div><div><dt>64인치 모니터</dt><dd>{quote.monitor?won(quote.monitor):'미선택'}</dd></div><div className="booking-total"><dt>지금 결제할 금액<small>숙박료 + 선택 옵션</small></dt><dd>{won(quote.total)}</dd></div></dl>
  <div className="dg-deposit-note"><span aria-hidden="true">ⓘ</span><p>시설 보증금 <b>{won(quote.depositAmount)}</b>은 별도입니다.<br/><span>위 결제금액에 포함되지 않으며 계좌이체로 납부합니다.</span></p></div>
 </div>;
}
