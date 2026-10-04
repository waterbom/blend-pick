'use client';
import {useEffect,useState} from 'react';
import {apiErrorMessage,readApiJson} from '@/lib/api-error-message';
import PhoneVerifyField from '@/components/PhoneVerifyField';
import ChannelSupportButton from '@/components/ChannelSupportButton';
type Question={id:string;category:string;message:string;reply:string|null;created_at:string;order_number?:string;product_name?:string};
export default function CustomerSupport({orderId,productId,channelEnabled}:{orderId?:string;productId?:string;channelEnabled:boolean}){
 const [items,setItems]=useState<Question[]>([]),[loading,setLoading]=useState(true),[historyError,setHistoryError]=useState('');
 const [message,setMessage]=useState(''),[category,setCategory]=useState(orderId?'주문·배송':'상품 문의'),[publicRequested,setPublic]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[key,setKey]=useState('');
 const [phone,setPhone]=useState(''),[verified,setVerified]=useState(false);
 async function load(){setLoading(true);setHistoryError('');try{const d=await readApiJson(await fetch('/api/customer/questions'),'문의 내역을 불러오지 못했습니다.');setItems(d.items);}catch(e){setHistoryError(apiErrorMessage(e));}finally{setLoading(false);}}
 useEffect(()=>{setKey(crypto.randomUUID());void load();},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  await readApiJson(await fetch('/api/customer/questions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_key:key,order_id:orderId,product_id:productId,category,message,public_requested:publicRequested})}),'문의 접수에 실패했습니다.');
  setMessage('');setKey(crypto.randomUUID());setNotice('문의가 접수되었습니다. 아래 문의 내역에서 답변을 확인해주세요.');await load();
 }catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 return <div className="customer-care"><h2>문의·상담</h2><p>주문과 상품을 연결해 문의를 남길 수 있습니다. 개인정보나 결제정보는 문의 내용에 적지 말아주세요.</p>
  <div className="care-actions"><a href="/mypage">주문 내역</a><a href="/my-shopping">관심 상품·알림</a><a href={'/login?redirect='+encodeURIComponent('/support'+(orderId?'?order='+orderId:productId?'?product='+productId:''))}>로그인</a></div>
  {orderId&&<details className="care-info"><summary>비회원 주문 문의 · 휴대폰 인증</summary><div className="care-form"><label>주문자 휴대폰<input type="tel" value={phone} onChange={e=>{setPhone(e.target.value);setVerified(false);}}/></label><PhoneVerifyField key={phone} phone={phone} verified={verified} onVerified={()=>{setVerified(true);void load();}}/></div></details>}
  {channelEnabled&&<div className="care-info"><ChannelSupportButton orderId={orderId}/></div>}
  <form className="care-form" onSubmit={submit}><h3>문의 작성</h3>{orderId&&<p>선택한 주문과 함께 접수합니다.</p>}{productId&&<p>선택한 상품과 함께 접수합니다.</p>}
   <label>문의 종류<select value={category} onChange={e=>setCategory(e.target.value)}>{['상품 문의','주문·배송','품질 문제','교환·반품','기타'].map(c=><option key={c}>{c}</option>)}</select></label>
   <label>문의 내용<textarea required maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)}/></label>
   {productId&&!orderId&&<label><input type="checkbox" checked={publicRequested} onChange={e=>setPublic(e.target.checked)}/> 다른 고객에게도 도움이 되도록 상품 Q&amp;A 공개에 동의합니다. 판매자 확인 후 게시됩니다.</label>}
   {category==='품질 문제'&&<p>사진 첨부와 교환·반품 신청은 <a href="/mypage#orders">주문 내역</a>에서 진행할 수 있습니다.</p>}
   <button disabled={busy||!key}>{busy?'접수 중…':'문의 접수'}</button>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</form>
  <div className="care-info"><h3>내 문의 내역</h3>{loading?<p>불러오는 중…</p>:historyError?<p role="alert">{historyError} <button onClick={load}>다시 조회</button></p>:items.length===0?<p>접수한 문의가 없습니다.</p>:items.map(q=><article className="care-row" key={q.id}><strong>{q.category} · {q.reply?'답변 완료':'답변 대기'}</strong><p className="care-muted">{q.order_number||q.product_name} · {new Date(q.created_at).toLocaleDateString('ko-KR')}</p><p className="whitespace-pre-wrap">{q.message}</p>{q.reply&&<div className="care-reply">{q.reply}</div>}</article>)}</div>
 </div>;
}
