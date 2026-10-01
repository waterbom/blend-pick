'use client';
import {useState} from 'react';
import {apiErrorMessage,readApiJson} from '@/lib/api-error-message';
type Selection={quote:string;items:{product_id:string;option_id?:string;name:string;option_label?:string;quantity:number;price:number}[]};
export default function ReorderButton({orderId}:{orderId:string}){
 const [preview,setPreview]=useState<Selection|null>(null),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function load(){setBusy(true);setError('');try{setPreview(await readApiJson(await fetch('/api/customer/reorder?order='+orderId),'다시 구매할 상품을 확인하지 못했습니다.'));setKey(crypto.randomUUID());}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 async function add(){setBusy(true);setError('');try{await readApiJson(await fetch('/api/customer/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order_id:orderId,quote:preview?.quote,request_key:key})}),'요청을 처리하지 못했습니다.');setDone(true);setPreview(null);}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 return <div className="text-xs"><button type="button" className="px-3.5 py-2 border" disabled={busy} onClick={load}>다시 구매</button>{preview&&<div className="customer-care"><strong>현재 판매가로 다시 구매</strong>{preview.items.map(i=><p key={i.product_id+':'+i.option_id}>{i.name} {i.option_label} · {Number(i.price).toLocaleString()}원 × {i.quantity}</p>)}<p>기존 장바구니에 수량이 추가됩니다. 배송비는 결제 화면에서 확인해주세요.</p><div className="care-actions"><button disabled={busy} onClick={add}>현재 가격 확인·장바구니 담기</button><button disabled={busy} onClick={()=>setPreview(null)}>닫기</button></div></div>}{done&&<a className="underline ml-2" href="/cart">담았습니다 · 장바구니 확인</a>}{error&&<p role="alert" className="text-red-700 whitespace-pre-wrap">{error}</p>}</div>;
}
