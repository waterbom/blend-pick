"use client";
import {useEffect,useRef,useState} from 'react';
interface PostcodeData {zonecode:string;roadAddress:string;jibunAddress:string;userSelectedType:'R'|'J'}
type PostcodeAPI={Postcode:new(options:{oncomplete:(data:PostcodeData)=>void;width?:string|number;height?:string|number;onresize?:(size:{height:number})=>void})=>{embed:(element:HTMLElement)=>void}};
declare global {interface Window {daum?:PostcodeAPI;kakao?:PostcodeAPI}}
const URL='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading:Promise<void>|null=null;
function loadPostcode(){
 if(window.kakao?.Postcode||window.daum?.Postcode)return Promise.resolve();
 if(!loading)loading=new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');script.src=URL;script.async=true;
   const timer=setTimeout(()=>{script.remove();loading=null;reject(Error('주소검색 연결이 지연되고 있습니다. 다시 시도해주세요.'));},12000);
   script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();loading=null;reject(Error('주소검색을 불러오지 못했습니다. 다시 시도해주세요.'));};document.head.appendChild(script);
 });return loading;
}
export default function AddressSearchButton({onSelect}:{onSelect:(zipcode:string,address:string)=>void}){
 const [open,setOpen]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 const host=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;let alive=true;setBusy(true);setError('');
 loadPostcode().then(()=>{if(!alive||!host.current)return;const api=window.kakao?.Postcode?window.kakao:window.daum;if(!api)throw Error('주소검색을 다시 실행해주세요.');
 host.current.replaceChildren();new api.Postcode({width:'100%',height:420,oncomplete(data){if(!alive)return;const address=data.userSelectedType==='R'?data.roadAddress:data.jibunAddress;if(!/^\d{5}$/.test(data.zonecode)||!address)return;onSelect(data.zonecode,address);setOpen(false);button.current?.focus();}}).embed(host.current);setBusy(false);
 }).catch(e=>{if(alive){setError(e.message);setBusy(false);}});return()=>{alive=false;};
 },[open,retry]);
 return <div>
  <button ref={button} type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{background:'var(--accent-soft)',color:'var(--accent)',border:'1px solid var(--line)'}}>🔍 {open?'주소검색 닫기':'우편번호 검색'}</button>
  {open&&<section aria-label="배송지 주소검색" className="border rounded-xl mt-2 p-2 bg-white" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}}}>
    {busy&&<p role="status" className="text-sm p-2">주소검색을 불러오는 중…</p>}
    {error&&<p role="alert" className="text-sm p-2">{error} <button type="button" className="underline" onClick={()=>{loading=null;setRetry(v=>v+1);}}>다시 시도</button></p>}
    <div ref={host} style={{width:'100%',minHeight:error?0:420}}/>
  </section>}
 </div>;
}
