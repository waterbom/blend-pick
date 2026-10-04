'use client';
import {useEffect,useState} from 'react';
import {apiErrorMessage,readApiJson} from '@/lib/api-error-message';
import {useSiteKey} from '@/components/SiteContext';
import AddressBook from '@/components/AddressBook';
type Interest={id:string;product_id:string;name:string;kind:string;status:string;option_label?:string;available:boolean;phone_notice:boolean};
type Notice={id:string;title:string;body:string;href:string;read_at:string|null;created_at:string};
export default function CustomerShopping(){
 const site=useSiteKey();const [items,setItems]=useState<Interest[]>([]),[notifications,setNotifications]=useState<Notice[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 async function load(){setLoading(true);setError('');try{const [a,b]=await Promise.all([fetch('/api/customer/interests').then(r=>readApiJson(r,'요청을 처리하지 못했습니다.')),fetch('/api/customer/notifications').then(r=>readApiJson(r,'요청을 처리하지 못했습니다.'))]);setItems(a.items);setNotifications(b.items);}catch(e){setError(apiErrorMessage(e));}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function cancel(id:string){setBusy(true);setError('');try{await readApiJson(await fetch('/api/customer/interests',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),'요청을 처리하지 못했습니다.');await load();}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 async function read(id:string){setBusy(true);setError('');try{await readApiJson(await fetch('/api/customer/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),'요청을 처리하지 못했습니다.');setNotifications(n=>n.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x));}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 const labels:Record<string,string>={wish:'관심 상품',restock:'재입고 알림',opening:'공구 오픈 알림',active:'신청 중',notified:'알림 등록 완료',expired:'신청 기간 종료'};
 return <div className="customer-care"><h2>관심 상품·알림</h2><div className="care-actions"><a href="/mypage">주문 내역</a><a href="/support">문의·상담</a><a href="/products">상품 둘러보기</a></div>
 {loading?<p>불러오는 중…</p>:error?<p role="alert">{error} <a href="/login?redirect=%2Fmy-shopping">로그인</a> <button onClick={load}>다시 조회</button></p>:<>
 <div className="care-info"><h3>저장한 상품</h3>{!items.length&&<p>상품 화면에서 관심 상품이나 알림을 신청해보세요.</p>}{items.map(i=><article className="care-row" key={i.id}><strong>{i.available?<a href={(site==='sanjipick'?'/p/':'/products/')+i.product_id}>{i.name}</a>:'현재 공개되지 않는 상품'}</strong>{i.option_label&&<p>{i.option_label}</p>}<p>{labels[i.kind]}{i.kind!=='wish'&&` · ${labels[i.status]} · ${i.phone_notice?'사이트·알림톡':'사이트 알림'}`}</p><button disabled={busy} onClick={()=>cancel(i.id)}>{i.kind==='wish'?'관심 상품 삭제':'알림 해지'}</button></article>)}</div>
 <div className="care-info"><h3>받은 알림</h3>{!notifications.length&&<p>아직 받은 알림이 없습니다.</p>}{notifications.map(n=><article className="care-row" key={n.id}><strong>{!n.read_at&&'● '}{n.title}</strong><p className="whitespace-pre-wrap">{n.body}</p><div className="care-actions"><a href={n.href}>확인하기</a>{!n.read_at&&<button disabled={busy} onClick={()=>read(n.id)}>읽음 표시</button>}</div></article>)}</div></>}
 <AddressBook/></div>;
}
