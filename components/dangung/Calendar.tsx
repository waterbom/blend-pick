'use client';
type Day={day:string;price:number;season:string;available:boolean;occupied:boolean};
type Props={current:Date;today?:string;dates:Day[];month:number;busy:boolean;selling:boolean;checkIn:string;checkOut:string;available:(day:string)=>boolean;canOut:(day:string)=>boolean;onChoose:(day:string)=>void;onMonth:(delta:number)=>void;onReset:()=>void};
const weekdays=['일','월','화','수','목','금','토'];
const compactDate=(day:string)=>{const d=new Date(day+'T00:00:00Z');return `${d.getUTCMonth()+1}.${d.getUTCDate()} (${weekdays[d.getUTCDay()]})`;};
export default function BookingCalendar({current,today,dates,month,busy,selling,checkIn,checkOut,available,canOut,onChoose,onMonth,onReset}:Props){
 const year=current.getUTCFullYear(),mo=current.getUTCMonth(),count=new Date(Date.UTC(year,mo+1,0)).getUTCDate(),leading=current.getUTCDay();
 const monthKey=`${year}-${String(mo+1).padStart(2,'0')}`;
 const monthAvailable=dates.filter(d=>d.day.startsWith(monthKey)&&available(d.day));
 const nights=checkIn&&checkOut?(Date.parse(checkOut)-Date.parse(checkIn))/86400000:0;
 return <div className="calendar-panel dg-calendar">
  <div className="dg-calendar-top"><div><span className="dg-calendar-eyebrow">YOUR STAY, YOUR DAY</span><h3>머무를 날짜를 골라보세요</h3></div><span className="dg-calendar-chip">독채 · 하루 한 팀</span></div>
  <div className="calendar-head"><div><h4 aria-live="polite">{today?`${year}년 ${mo+1}월`:'달력 불러오는 중'}</h4><p>{selling&&monthAvailable.length?`1박 ${(Math.min(...monthAvailable.map(d=>d.price))/10000).toLocaleString('ko-KR')}만원부터`:'날짜별 예약 가능 여부를 확인하세요'}</p></div><div className="dg-month-nav"><button type="button" aria-label="이전 달" disabled={!today||month===0||busy} onClick={()=>onMonth(-1)}>←</button><button type="button" aria-label="다음 달" disabled={!today||month>=12||busy} onClick={()=>onMonth(1)}>→</button></div></div>
  <div className="dg-calendar-key" aria-label="달력 색상 안내"><span><i className="key-normal"/>일반·비성수기</span><span><i className="key-shoulder"/>준성수기</span><span><i className="key-peak"/>극성수기</span><span><i className="key-weekend"/>금·토 주말</span></div>
  <div className="calendar-week" aria-hidden="true">{weekdays.map((d,i)=><span key={d} className={i===5||i===6?'weekend-heading':''}>{d}{i===5||i===6?<small>주말</small>:null}</span>)}</div>
  <div className="calendar-days" role="group" aria-label="숙박 날짜 선택">
  {today&&<>{Array.from({length:leading},(_,i)=><span key={`empty-${i}`} aria-hidden="true" className="dg-empty-day"/>)}
   {Array.from({length:count},(_,i)=>{
    const day=`${monthKey}-${String(i+1).padStart(2,'0')}`,row=dates.find(d=>d.day===day),weekday=new Date(day+'T00:00:00Z').getUTCDay(),weekend=weekday===5||weekday===6;
    const open=available(day),out=!!(checkIn&&!checkOut&&day>checkIn&&canOut(day)),start=day===checkIn,end=day===checkOut,inside=!!(checkIn&&checkOut&&day>checkIn&&day<checkOut),past=day<today;
    const season=row?.season.includes('극성수기')?'peak':row?.season.includes('준성수기')?'shoulder':row?.season.includes('일반')||row?.season.includes('비수기')?'normal':'custom';
    const tag=season==='peak'?'극성수':season==='shoulder'?'준성수':season==='custom'?'별도요금':weekend?'주말':'평일';
    const disabled=busy||(!open&&!out);
    return <button key={day} type="button" disabled={disabled} className={`season-${season} ${weekend?'is-weekend':''} ${start?'selected range-start':''} ${end?'selected range-end':''} ${inside?'in-range':''} ${past?'is-past':''} ${!open&&!out?'is-unavailable':''} ${day===today?'is-today':''}`}
     aria-pressed={start||end||inside} aria-current={day===today?'date':undefined}
     aria-label={`${day}${start?' 입실일':end?' 퇴실일':''}${row&&open?` ${row.season} ${row.price.toLocaleString('ko-KR')}원`:past?' 지난 날짜':row?.occupied?' 예약 마감':' 예약 불가'}${out?' · 퇴실일 선택 가능':''}`}
     onClick={()=>onChoose(day)}>
      <span className="dg-day-top"><b>{i+1}</b>{weekend&&open&&<i className="dg-weekend-dot" aria-hidden="true"/>}</span>
      <small className="day-price">{end?'요금 없음':open&&row?`${(row.price/10000).toLocaleString('ko-KR')}만`:out?'퇴실 가능':past?'—':day===today?'오늘':'마감'}</small>
      <span className="dg-day-label">{start?'입실':end?'퇴실':open?tag:out?'체크아웃':'\u00a0'}</span>
    </button>;
   })}
  </>}
  </div>
  <p className="date-hint" role="status"><span className="dg-hint-icon" aria-hidden="true">{nights?'✓':'↗'}</span>{!selling?'예약 가능한 날짜가 열리면 요금이 표시됩니다.':nights?`${nights}박 ${nights+1}일 선택 완료 · 인원과 옵션을 확인해 주세요.`:checkIn?'이제 퇴실일을 선택해 주세요. 퇴실일 요금은 제외됩니다.':'입실일과 퇴실일을 차례로 선택해 주세요.'}</p>
  <div className="stay-date-cards"><div className={checkIn?'has-date':''}><small>입실 <span>15:00</span></small><strong>{checkIn?compactDate(checkIn):'날짜 선택'}</strong></div><span className="dg-stay-length">{nights?`${nights}박`:'→'}</span><div className={checkOut?'has-date':''}><small>퇴실 <span>11:00</span></small><strong>{checkOut?compactDate(checkOut):'날짜 선택'}</strong></div></div>
  <div className="dg-calendar-bottom"><span>1박 · 기준 6인 / 추가 옵션 별도</span><button type="button" className="text-button" disabled={busy||!checkIn} onClick={onReset}>선택 초기화 ↺</button></div>
 </div>;
}
