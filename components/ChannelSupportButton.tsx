'use client';
import {useEffect,useState} from 'react';
import {readApiJson,apiErrorMessage} from '@/lib/api-error-message';
type Channel=(...args:unknown[])=>void;
declare global {interface Window {ChannelIO?:Channel;}}
let loading:Promise<void>|null=null;
function loadChannel(){
 if(loading)return loading;
 if(window.ChannelIO)return Promise.resolve();
 if(!loading)loading=new Promise<void>((resolve,reject)=>{
  const channel=Object.assign((...args:unknown[])=>{channel.q.push(args);},{q:[] as unknown[][]});
  window.ChannelIO=channel;
  const script=document.createElement('script');script.src='https://cdn.channel.io/plugin/ch-plugin-web.js';script.async=true;
  const timer=setTimeout(()=>{script.remove();delete window.ChannelIO;loading=null;reject(new Error('상담 연결 시간이 초과되었습니다. 문의 작성으로 접수해주세요.'));},15000);
  script.onload=()=>{clearTimeout(timer);window.ChannelIO?resolve():reject(new Error('상담 창을 불러오지 못했습니다.'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();delete window.ChannelIO;loading=null;reject(new Error('상담 창을 불러오지 못했습니다.'));};
  document.head.appendChild(script);
 });return loading;
}
export default function ChannelSupportButton({orderId}:{orderId?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{window.ChannelIO?.('shutdown');},[]);
 async function open(){setBusy(true);setError('');try{
  const options=await readApiJson(await fetch('/api/customer/channel'+(orderId?'?order='+encodeURIComponent(orderId):'')),'상담 연결에 실패했습니다.');
  await loadChannel();
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('상담 연결 시간이 초과되었습니다.')),15000);
   window.ChannelIO?.('shutdown');
   window.ChannelIO?.('boot',options,(e:unknown)=>{clearTimeout(timer);if(e)reject(new Error('상담 인증에 실패했습니다. 문의 작성으로 접수해주세요.'));else{window.ChannelIO?.('showMessenger');resolve();}});
  });
 }catch(e){setError(apiErrorMessage(e,'상담 창을 열지 못했습니다. 아래 문의 작성으로 접수해주세요.'));}finally{setBusy(false);}}
 return <div><button type="button" disabled={busy} onClick={open}>{busy?'연결 중…':'주문 정보와 함께 채팅 상담'}</button><p className="care-muted">연결 시 상담 서비스에 회원 식별값과 선택한 주문번호·진행 상태를 전달합니다.</p>{error&&<p role="alert">{error}</p>}</div>;
}
