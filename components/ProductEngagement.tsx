'use client';
import {useEffect,useState} from 'react';
import {apiErrorMessage,readApiJson} from '@/lib/api-error-message';
import PhoneVerifyField from '@/components/PhoneVerifyField';
import {PRODUCT_CARE_FIELDS,type ProductCare} from '@/lib/product-care';
type Option={id:string;name:string;value:string;stock:number;is_active:boolean};
export default function ProductEngagement({productId,options=[],opening=false,soldOut=false}:{productId:string;options?:Option[];opening?:boolean;soldOut?:boolean}){
 const [info,setInfo]=useState<Partial<ProductCare>>({}),[questions,setQuestions]=useState<{id:string;message:string;reply:string}[]>([]);
 const [channels,setChannels]=useState<Record<string,boolean>>({}),[option,setOption]=useState(!opening&&!soldOut?options.find(o=>o.is_active&&o.stock===0)?.id||'':''),[subscribe,setSubscribe]=useState(false);
 const [phone,setPhone]=useState(''),[verified,setVerified]=useState(false),[phoneNotice,setPhoneNotice]=useState(false),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const kind=opening?'opening':'restock';
 const unavailable=options.filter(o=>o.is_active&&(soldOut||o.stock===0));
 useEffect(()=>{let live=true;Promise.all([
  fetch('/api/customer/product-info?product='+productId).then(r=>readApiJson(r,'상품 안내를 불러오지 못했습니다.')),
  fetch('/api/customer/questions?product='+productId).then(r=>readApiJson(r,'상품 문의를 불러오지 못했습니다.'))
 ]).then(([a,b])=>{if(live){setInfo(a.info||{});setChannels(a.channels||{});setQuestions(b.items||[]);}}).catch(e=>{if(live)setError(apiErrorMessage(e));});return()=>{live=false;};},[productId]);
 async function save(kind:string){setBusy(true);setError('');setMessage('');try{
  await readApiJson(await fetch('/api/customer/interests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:productId,option_id:option,kind,consent,phone_notice:kind!=='wish'&&phoneNotice})}),'관심 상품 저장에 실패했습니다.');
  setMessage(kind==='wish'?'관심 상품에 저장했습니다.':'알림 신청을 저장했습니다. 관심 상품·알림에서 확인할 수 있습니다.');setSubscribe(false);
 }catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 return <section className="customer-care" aria-label="상품 안내와 문의">
  <div className="care-actions"><button type="button" disabled={busy} onClick={()=>save('wish')}>♡ 관심 상품</button>
   {(opening||soldOut||unavailable.length>0)&&<button type="button" onClick={()=>setSubscribe(!subscribe)}>{opening?'공구 오픈 알림':'재입고 알림'}</button>}
   <a href={'/support?product='+productId}>상품 문의하기</a><a href="/my-shopping">관심 상품·알림 보기</a></div>
  {subscribe&&<div className="care-form"><h3>{opening?'공구 오픈':'재입고'} 알림 신청</h3>
   {(opening?options.filter(o=>o.is_active):unavailable).length>0&&<label>옵션<select value={option} onChange={e=>setOption(e.target.value)}>{(opening||soldOut)&&<option value="">상품 전체</option>}{(opening?options.filter(o=>o.is_active):unavailable).map(o=><option key={o.id} value={o.id}>{o.name} · {o.value}</option>)}</select></label>}
   <p>신청 후 90일 동안 판매 시작 또는 재입고 시 한 번 알려드립니다. 알림은 재고 확보를 보장하지 않으며, 관심 상품·알림에서 해지할 수 있습니다.</p>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> 신청한 상품의 사이트 내 알림을 받겠습니다.</label>
   {channels[kind]&&<><label><input type="checkbox" checked={phoneNotice} onChange={e=>setPhoneNotice(e.target.checked)}/> 같은 소식을 카카오 알림톡으로도 받겠습니다.</label>
    {phoneNotice&&<><label>알림 받을 휴대폰<input type="tel" value={phone} onChange={e=>{setPhone(e.target.value);setVerified(false);}}/></label><PhoneVerifyField key={phone} phone={phone} verified={verified} onVerified={()=>setVerified(true)}/><p>인증한 번호는 신청한 알림 발송에만 사용하며 신청 종료 후 최대 90일 내 삭제합니다.</p></>}</>}
   <button type="button" disabled={busy||!consent||(phoneNotice&&!verified)} onClick={()=>save(kind)}>알림 신청</button></div>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error} <a href={'/login?redirect='+encodeURIComponent(typeof window!=='undefined'?window.location.pathname:'/my-shopping')}>로그인 확인</a></p>}
  {Object.values(info).some(Boolean)&&<div className="care-info"><h3>상품·품질 안내</h3><dl>{Object.entries(PRODUCT_CARE_FIELDS).map(([key,label])=>info[key as keyof ProductCare]&&<div key={key}><dt>{label}</dt><dd>{info[key as keyof ProductCare]}</dd></div>)}</dl>
   <a href="/support">품질 문제 문의</a><p>수령한 상품의 상태와 포장 상태를 확인해주세요. 주문 내역에서 사진을 첨부해 교환·반품을 신청할 수 있습니다.</p></div>}
  <div className="care-info"><h3>상품 Q&amp;A</h3>{questions.length?questions.map(q=><details key={q.id}><summary>{q.message}</summary><p className="whitespace-pre-wrap">{q.reply}</p></details>):<p>궁금한 점을 남겨주시면 판매자가 확인 후 답변합니다.</p>}</div>
 </section>;
}
