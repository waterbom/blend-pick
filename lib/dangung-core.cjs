const {randomUUID,createHash}=require('node:crypto');
class BookingError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=(message,status)=>{throw new BookingError(message,status);};
const hash=token=>createHash('sha256').update(token).digest('hex');
const iso=d=>typeof d==='string'?d.slice(0,10):d.toISOString().slice(0,10);
const today=(now=new Date())=>new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('올바른 날짜를 선택해 주세요.');return value;}
function days(start,end,max=366){date(start);date(end);const n=(Date.parse(end)-Date.parse(start))/86400000;if(n<1||n>max)fail('예약 기간을 확인해 주세요.');return Array.from({length:n},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));}
function integer(v,min,max,name){if(!Number.isSafeInteger(v)||v<min||v>max)fail(`${name}을 확인해 주세요.`);return v;}
function validateConfig(c){
 if(c.depositPaymentNote!==undefined&&(typeof c.depositPaymentNote!=='string'||c.depositPaymentNote.length>2000))fail('보증금 납부 안내를 확인해 주세요.');
 if(typeof c.enabled!=='boolean')fail('판매 상태를 확인해 주세요.');
 integer(c.minLeadDays,1,365,'예약 준비일');integer(c.maxNights,1,30,'최대 숙박일');
 if(c.enabled){integer(c.extraGuestFee,0,1000000,'추가 인원 요금');integer(c.bbqFee,0,1000000,'바비큐 요금');integer(c.depositAmount,0,1000000,'시설 보증금');
 if(c.monitorFee!==undefined)integer(c.monitorFee,0,1000000,'64인치 모니터 요금');
 if(!['perNight','perStay'].includes(c.extraGuestUnit))fail('추가 인원 요금의 박당/예약당 기준을 선택해 주세요.');
 if(typeof c.refundTerms!=='string'||c.refundTerms.trim().length<20||c.refundTerms.length>4000)fail('확정된 취소·환불 규정을 입력해 주세요.');
 if(typeof c.depositTerms!=='string'||c.depositTerms.trim().length<10||c.depositTerms.length>2000)fail('보증금·현장 결제 조건을 입력해 주세요.');
 }
 return c;
}
function quote(config,version,rows,input,now=new Date()){
 if(!config.enabled)fail('예약 오픈 준비 중입니다. 확정 요금과 예약 가능일을 곧 안내해 드릴게요.',409);
 validateConfig(config);const stay=days(input.checkIn,input.checkOut,config.maxNights);
 const first=new Date(Date.parse(today(now))+config.minLeadDays*86400000).toISOString().slice(0,10);
 if(input.checkIn<first||input.checkOut>new Date(Date.parse(today(now))+366*86400000).toISOString().slice(0,10))fail('예약 가능한 날짜를 선택해 주세요.');
 integer(input.guests,1,16,'36개월 이상 이용 인원');if(typeof input.bbq!=='boolean')fail('바비큐 선택을 확인해 주세요.');
 const infants=input.infants===undefined?0:integer(input.infants,0,99,'36개월 미만 유아 인원');
 const monitor=input.monitor===undefined?false:input.monitor;
 if(typeof monitor!=='boolean')fail('64인치 모니터 선택을 확인해 주세요.');
 if(monitor)integer(config.monitorFee,0,1000000,'64인치 모니터 요금');
 const nightly=stay.map(day=>{const r=rows.find(r=>iso(r.day)===day);if(!r||!r.available||r.occupied)fail('선택한 기간에 마감되었거나 아직 열리지 않은 날짜가 있습니다.',409);return {day,price:r.price,season:r.season};});
 const lodging=nightly.reduce((s,d)=>s+d.price,0), extra=Math.max(0,input.guests-6)*config.extraGuestFee*(config.extraGuestUnit==='perNight'?stay.length:1),bbq=input.bbq?config.bbqFee:0,monitorAmount=monitor?config.monitorFee:0;
 return {version,checkIn:input.checkIn,checkOut:input.checkOut,guests:input.guests,infants,selectedOptions:{bbq:input.bbq,monitor},nightly,lodging,extra,bbq,monitor:monitorAmount,total:lodging+extra+bbq+monitorAmount,extraGuestUnit:config.extraGuestUnit,depositAmount:config.depositAmount,depositTerms:config.depositTerms,depositPaymentNote:config.depositPaymentNote||'',refundTerms:config.refundTerms};
}
const publicReservation=r=>({id:r.id,status:r.status,checkIn:iso(r.check_in),checkOut:iso(r.check_out),guests:r.guests,infants:r.quote.infants||0,buyerName:r.buyer_name,quote:r.quote,amount:r.amount,expiresAt:r.expires_at,receiptUrl:r.receipt_url,cancelRequested:r.cancel_requested,refundAmount:r.refund_amount});
function service(pool,provider,{now=()=>new Date()}={}){
 async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const {rows:[s]}=await c.query('SELECT * FROM dangung_settings WHERE id=1 FOR UPDATE');if(!s)fail('예약 설정을 준비 중입니다.',503);const result=await fn(c,s);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function audit(c,action,id,detail={}){await c.query('INSERT INTO dangung_audit(action,reservation_id,detail) VALUES($1,$2,$3)',[action,id,JSON.stringify(detail)]);}
 async function expire(c){await c.query("DELETE FROM dangung_occupancy WHERE reservation_id IN (SELECT id FROM dangung_reservations WHERE status='pending' AND expires_at<=$1)",[now()]);await c.query("UPDATE dangung_reservations SET status='expired',updated_at=$1 WHERE status='pending' AND expires_at<=$1",[now()]);}
 async function owned(c,id,owner){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))fail('예약을 찾을 수 없습니다.',404);const {rows:[r]}=await c.query('SELECT * FROM dangung_reservations WHERE id=$1',[id]);if(!r||(owner!==null&&r.owner_hash!==hash(owner)))fail('예약을 찾을 수 없습니다.',404);return r;}
 async function calendar(){const {rows:[s]}=await pool.query('SELECT * FROM dangung_settings WHERE id=1');if(!s)fail('예약 설정을 준비 중입니다.',503);
 const {rows}=await pool.query(`SELECT d.*,EXISTS(SELECT 1 FROM dangung_occupancy o JOIN dangung_reservations r ON r.id=o.reservation_id WHERE o.day=d.day AND (r.status<>'pending' OR r.expires_at>$1)) AS occupied FROM dangung_dates d WHERE day>=$2 AND day<=$3 ORDER BY day`,[now(),today(now()),new Date(Date.parse(today(now()))+366*86400000).toISOString().slice(0,10)]);
 return {config:s.config,version:s.version,today:today(now()),dates:rows.map(r=>({...r,day:iso(r.day)}))};}
 async function getQuote(input){const c=await calendar();return quote(c.config,c.version,c.dates,input,now());}
 async function reserve(input,owner){return tx(async(c,s)=>{
 await expire(c);if(!/^[a-f0-9-]{36}$/i.test(input.requestId||''))fail('예약 요청을 다시 진행해 주세요.');
 const {rows:[prior]}=await c.query('SELECT * FROM dangung_reservations WHERE owner_hash=$1 AND request_id=$2',[hash(owner),input.requestId]);
 if(prior){if(iso(prior.check_in)!==input.checkIn||iso(prior.check_out)!==input.checkOut||prior.guests!==input.guests||prior.amount!==input.amount||prior.buyer_name!==input.buyerName?.trim()||prior.buyer_phone!==input.buyerPhone||prior.memo!==input.memo||(prior.quote.infants||0)!==(input.infants===undefined?0:input.infants)||(prior.quote.selectedOptions?.bbq??(prior.quote.bbq>0))!==input.bbq||(prior.quote.selectedOptions?.monitor??false)!==(input.monitor===undefined?false:input.monitor))fail('이미 사용한 예약 요청입니다. 새로 확인해 주세요.',409);return publicReservation(prior);}
 const {rows:[count]}=await c.query("SELECT count(*)::int AS n FROM dangung_reservations WHERE owner_hash=$1 AND status IN ('pending','confirming','cancelling')",[hash(owner)]);if(count.n>=2)fail('진행 중인 예약을 먼저 확인해 주세요.',409);
 if(typeof input.buyerName!=='string'||input.buyerName.trim().length<2||input.buyerName.length>40||!/^01[016789]\d{7,8}$/.test(input.buyerPhone||'')||typeof input.memo!=='string'||input.memo.length>300)fail('예약자 이름·휴대폰 번호·요청사항을 확인해 주세요.');
 const {rows}=await c.query('SELECT d.*,EXISTS(SELECT 1 FROM dangung_occupancy o WHERE o.day=d.day) AS occupied FROM dangung_dates d WHERE day>=$1 AND day<$2',[date(input.checkIn),date(input.checkOut)]);
 const q=quote(s.config,s.version,rows,input,now());if(input.version!==s.version||input.amount!==q.total||input.agreed!==true)fail('요금 또는 이용 조건이 변경되었습니다. 다시 확인해 주세요.',409);
 const id=randomUUID(),expires=new Date(now().getTime()+15*60000);
 const {rows:[r]}=await c.query(`INSERT INTO dangung_reservations(id,request_id,owner_hash,status,check_in,check_out,guests,buyer_name,buyer_phone,memo,quote,amount,expires_at) VALUES($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[id,input.requestId,hash(owner),input.checkIn,input.checkOut,input.guests,input.buyerName.trim(),input.buyerPhone,input.memo,JSON.stringify(q),q.total,expires]);
 for(const d of q.nightly)await c.query('INSERT INTO dangung_occupancy(day,reservation_id) VALUES($1,$2)',[d.day,id]);await audit(c,'reserved',id);return publicReservation(r);
 });}
 async function status(id,owner){return tx(async c=>{await expire(c);return publicReservation(await owned(c,id,owner));});}
 async function finish(id,payment){return tx(async c=>{const r=await owned(c,id,null);
 if(payment.orderId!==r.id||payment.totalAmount!==r.amount||payment.currency!=='KRW')fail('결제 정보가 일치하지 않습니다. 고객센터로 문의해 주세요.',409);
 if(r.payment_key&&payment.paymentKey!==r.payment_key)fail('결제 식별자가 일치하지 않습니다.',409);
 if(payment.status==='DONE'&&r.status==='confirming'){
 const {rows:[held]}=await c.query('SELECT count(*)::int AS n FROM dangung_occupancy WHERE reservation_id=$1',[id]);if(held.n!==r.quote.nightly.length)fail('예약 날짜 확인이 필요합니다.',409);
 const receipt=typeof payment.receipt?.url==='string'&&payment.receipt.url.startsWith('https://')?payment.receipt.url:null;
 await c.query("UPDATE dangung_reservations SET status='paid',payment_key=$2,receipt_url=$3,paid_at=$4,updated_at=$4 WHERE id=$1",[id,payment.paymentKey,receipt,now()]);await audit(c,'paid',id);
 }else if(['CANCELED','PARTIAL_CANCELED'].includes(payment.status)&&r.status==='cancelling'){
 const refunded=(payment.cancels||[]).reduce((s,x)=>s+x.cancelAmount,0);
 if(refunded!==r.refund_amount)fail('환불 금액 확인이 필요합니다.',409);
 await c.query("UPDATE dangung_reservations SET status='cancelled',updated_at=$2 WHERE id=$1",[id,now()]);await c.query('DELETE FROM dangung_occupancy WHERE reservation_id=$1',[id]);await audit(c,'cancelled',id,{refundAmount:refunded});
 }
 return publicReservation(await owned(c,id,null));});}
 async function confirm(input,owner){const r=await tx(async c=>{await expire(c);const r=await owned(c,input.orderId,owner);
 if(input.amount!==r.amount)fail('결제 금액이 일치하지 않습니다.',409);
 if(!['pending','confirming','paid'].includes(r.status))fail('예약 유효 시간이 만료되었거나 취소되었습니다.',409);
 if(typeof input.paymentKey!=='string'||input.paymentKey.length<10||input.paymentKey.length>300)fail('결제 정보를 확인해 주세요.');
 if(r.payment_key&&r.payment_key!==input.paymentKey)fail('이미 다른 결제가 연결된 예약입니다.',409);
 if(r.status==='pending'){await c.query("UPDATE dangung_reservations SET status='confirming',payment_key=$2,updated_at=$3 WHERE id=$1",[r.id,input.paymentKey,now()]);await audit(c,'confirming',r.id);}
 return r;});
 if(r.status==='paid')return publicReservation(r);
 // Stable key makes retries safe across double clicks, process restarts and DB failures.
 const payment=await provider.confirm({orderId:r.id,paymentKey:input.paymentKey,amount:r.amount});return finish(r.id,payment);
 }
 async function abandon(id,owner){return tx(async c=>{const r=await owned(c,id,owner);if(r.status==='pending'){await c.query("UPDATE dangung_reservations SET status='expired',updated_at=$2 WHERE id=$1",[id,now()]);await c.query('DELETE FROM dangung_occupancy WHERE reservation_id=$1',[id]);await audit(c,'abandoned',id);}return publicReservation(await owned(c,id,owner));});}
 async function requestCancel(id,owner){return tx(async c=>{const r=await owned(c,id,owner);if(r.status!=='paid')fail('결제 완료 예약만 취소를 요청할 수 있습니다.',409);await c.query('UPDATE dangung_reservations SET cancel_requested=true WHERE id=$1',[id]);await audit(c,'cancel_requested',id);return publicReservation(await owned(c,id,owner));});}
 /** @param {string} id @param {string|null} [owner] */
 async function reconcile(id,owner=null){const r=await tx(c=>owned(c,id,owner));if(!['confirming','cancelling'].includes(r.status))return publicReservation(r);if(r.status==='cancelling'&&r.refund_amount===0)return cancel(id,0,r.cancel_reason);return finish(id,await provider.lookup(id));}
 async function cancel(id,amount,reason){const r=await tx(async c=>{const r=await owned(c,id,null);integer(amount,0,r.amount,'환불 금액');if(typeof reason!=='string'||reason.trim().length<2||reason.length>200)fail('취소 사유를 입력해 주세요.');if(r.status==='cancelled')return r;
 if(r.status==='cancelling'){if(r.refund_amount!==amount||r.cancel_reason!==reason)fail('진행 중인 취소 요청을 먼저 복구해 주세요.',409);return r;}
 if(r.status!=='paid')fail('결제 완료 예약만 취소할 수 있습니다.',409);
 await c.query("UPDATE dangung_reservations SET status='cancelling',refund_amount=$2,cancel_reason=$3,updated_at=$4 WHERE id=$1",[id,amount,reason,now()]);await audit(c,'cancelling',id,{amount,reason});return r;});
 if(r.status==='cancelled')return publicReservation(r);
 if(amount===0)return tx(async c=>{await c.query("UPDATE dangung_reservations SET status='cancelled',updated_at=$2 WHERE id=$1 AND status='cancelling' AND refund_amount=0",[id,now()]);await c.query('DELETE FROM dangung_occupancy WHERE reservation_id=$1',[id]);await audit(c,'cancelled_without_refund',id);return publicReservation(await owned(c,id,null));});
 return finish(id,await provider.cancel(r.payment_key,amount,reason,id));
 }
 async function admin(){const calendarData=await calendar();const {rows}=await pool.query('SELECT id,status,check_in,check_out,guests,buyer_name,buyer_phone,memo,amount,quote,refund_amount,cancel_requested,created_at FROM dangung_reservations ORDER BY created_at DESC LIMIT 300');const {rows:[totals]}=await pool.query("SELECT count(*) FILTER(WHERE status='paid')::int AS paid_count,COALESCE(sum(amount) FILTER(WHERE status IN ('paid','cancelling')),0)::bigint AS paid_amount,COALESCE(sum(amount-refund_amount) FILTER(WHERE status='cancelled'),0)::bigint AS retained_amount FROM dangung_reservations");return {...calendarData,reservations:rows,totals};}
 async function settings(config){validateConfig(config);return tx(async(c)=>{await c.query('UPDATE dangung_settings SET config=$1,version=version+1 WHERE id=1',[JSON.stringify(config)]);await audit(c,'settings_changed',null,{enabled:config.enabled});return {ok:true};});}
 async function setDates(input){const selected=days(date(input.start),date(input.end),366);integer(input.weekdayPrice,1,10000000,'주중 요금');integer(input.weekendPrice,1,10000000,'금·토 요금');if(typeof input.season!=='string'||!input.season.trim()||input.season.length>40||typeof input.available!=='boolean')fail('시즌명과 판매 상태를 확인해 주세요.');return tx(async(c)=>{for(const day of selected){const weekday=new Date(day).getUTCDay();await c.query('INSERT INTO dangung_dates(day,price,season,available) VALUES($1,$2,$3,$4) ON CONFLICT(day) DO UPDATE SET price=EXCLUDED.price,season=EXCLUDED.season,available=EXCLUDED.available',[day,[5,6].includes(weekday)?input.weekendPrice:input.weekdayPrice,input.season.trim(),input.available]);}await c.query('UPDATE dangung_settings SET version=version+1 WHERE id=1');await audit(c,'dates_changed',null,{start:input.start,end:input.end,days:selected.length});return {ok:true,count:selected.length};});}
 return {calendar,getQuote,reserve,status,confirm,abandon,requestCancel,reconcile,cancel,admin,settings,setDates};
}
module.exports={BookingError,hash,iso,today,date,days,validateConfig,quote,service};
