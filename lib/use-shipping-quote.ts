'use client';
import {useEffect,useState,useRef} from 'react';
import type {CartAmountItem} from '@/lib/order-amount';
export type ShippingQuote={goodsAmount:number;installationCost:number;shippingCost:number;regionalCost:number;totalAmount:number;bundles:number};
export function useShippingQuote(items:CartAmountItem[],zipcode:string,expectedGoods:number){
  const key=JSON.stringify({items,shippingZipcode:zipcode});
  const [state,setState]=useState<{key:string;quote:ShippingQuote|null;error:string}>({key:'',quote:null,error:''});
  const current=useRef(key);current.current=key;
  async function request(signal?:AbortSignal){
    const res=await fetch('/api/checkout/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'배송비 확인에 실패했습니다.');
    if(data.goodsAmount!==expectedGoods)throw Error('상품 가격이 변경되었습니다. 상품을 다시 확인해주세요.');
    return data as ShippingQuote;
  }
  useEffect(()=>{
    if(!items.length||!/^\d{5}$/.test(zipcode))return;
    const abort=new AbortController();
    request(abort.signal).then(quote=>{if(current.current===key)setState({key,quote,error:''});}).catch(e=>{if(!abort.signal.aborted&&current.current===key)setState({key,quote:null,error:e.message});});
    return ()=>abort.abort();
  },[key,expectedGoods]);
  const quote=state.key===key?state.quote:null;
  async function refresh(){
    try{const next=await request();if(current.current!==key)throw Error('배송지가 변경되었습니다. 다시 확인해주세요.');setState({key,quote:next,error:''});return next;}
    catch(e){if(current.current===key)setState({key,quote:null,error:(e as Error).message});throw e;}
  }
  return {quote,ready:!!quote,error:state.key===key?state.error:'',refresh};
}
