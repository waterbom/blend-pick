'use client';
import {useState} from 'react';
import {optionText} from '@/lib/buyer-flow';
export default function CheckoutItemEditor({item,disabled,onApply,onDirty}:{item:any;disabled:boolean;onDirty:(dirty:boolean)=>void;onApply:(option:string|null,quantity:number)=>Promise<void>}){
 const [option,setOption]=useState(item.option_id||''),[quantity,setQuantity]=useState(String(item.quantity));
 return <div className="mt-2 flex flex-wrap gap-2 items-center">
 {item.availableOptions?.length>0&&<select aria-label={`${item.name} 옵션 변경`} className="border p-1 max-w-full text-xs" disabled={disabled} value={option} onChange={e=>{setOption(e.target.value);onDirty(e.target.value!==(item.option_id||'')||quantity!==String(item.quantity));}}>{item.availableOptions.map((o:any)=><option key={o.id} value={o.id}>{optionText(o.name,o.value)} · {o.price.toLocaleString()}원</option>)}</select>}
 <input aria-label={`${item.name} 수량 변경`} className="border p-1 w-16 text-xs" type="number" min={1} max={999} disabled={disabled} value={quantity} onChange={e=>{setQuantity(e.target.value);onDirty(option!==(item.option_id||'')||e.target.value!==String(item.quantity));}}/>
 <button type="button" className="text-xs underline" disabled={disabled||!Number.isSafeInteger(Number(quantity))||Number(quantity)<1||Number(quantity)>999} onClick={()=>onApply(option||null,Number(quantity))}>변경 적용</button>
 <button type="button" className="text-xs underline" disabled={disabled} onClick={()=>{setOption(item.option_id||'');setQuantity(String(item.quantity));onDirty(false);}}>변경 취소</button>
 </div>;
}
