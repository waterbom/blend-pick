'use client';
import {useEffect,useState} from 'react';
import {apiErrorMessage,readApiJson} from '@/lib/api-error-message';
export type SavedAddress={id?:string;label:string;recipient:string;phone:string;zipcode:string;address:string;detail:string};
export default function AddressBook({onSelect,current}:{onSelect?:(a:SavedAddress)=>void;current?:SavedAddress}){
 const [items,setItems]=useState<SavedAddress[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[opened,setOpened]=useState(false),[label,setLabel]=useState('집');
 async function load(){setBusy(true);setError('');try{const d=await readApiJson(await fetch('/api/customer/addresses'),'배송지를 불러오지 못했습니다.');setItems(d.items);}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 async function save(){setBusy(true);setError('');try{await readApiJson(await fetch('/api/customer/addresses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...current,label})}),'배송지 저장에 실패했습니다.');setNotice('배송지를 저장했습니다.');await load();}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 async function remove(id?:string){setBusy(true);setError('');try{await readApiJson(await fetch('/api/customer/addresses',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}),'요청을 처리하지 못했습니다.');await load();}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 return <div className="customer-care"><button type="button" onClick={()=>{setOpened(!opened);if(!opened)void load();}}>배송지 주소록 {opened?'닫기':'열기'}</button>{opened&&<div className="care-form"><p>로그인한 계정에 최대 10개까지 저장합니다.</p>{busy?<p>처리 중…</p>:items.map(a=><div className="care-row" key={a.id}><strong>{a.label} · {a.recipient}</strong><p>[{a.zipcode}] {a.address} {a.detail}</p><div className="care-actions">{onSelect&&<button type="button" onClick={()=>{onSelect(a);setNotice('배송지를 적용했습니다. 배송비와 받는 분 정보를 확인해주세요.');}}>이 배송지 사용</button>}<button type="button" onClick={()=>remove(a.id)}>삭제</button></div></div>)}
  {current&&<><label>배송지 이름<input value={label} maxLength={30} onChange={e=>setLabel(e.target.value)} placeholder="집, 부모님 댁"/></label><button type="button" disabled={busy} onClick={save}>현재 입력한 배송지 저장</button></>}
  {error&&<p role="alert">{error} <a href="/login?redirect=%2Fmy-shopping">로그인</a></p>}{notice&&<p role="status">{notice}</p>}</div>}</div>;
}
