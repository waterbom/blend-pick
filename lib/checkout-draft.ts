export const CHECKOUT_DRAFT_KEY='checkout-form:v1';
export function restoreCheckoutForm<T extends Record<string,string|boolean>>(raw:string|null,empty:T,now=Date.now()):T|null{
 try{const d=JSON.parse(raw||'null');if(!d||!Number.isFinite(d.at)||now-d.at>30*60_000||d.at>now+60000)return null;
 const next={...empty};for(const k of Object.keys(empty)){const v=d.form?.[k];if(typeof empty[k]==='boolean'){if(typeof v==='boolean')(next as Record<string,unknown>)[k]=v;}else if(typeof v==='string')(next as Record<string,unknown>)[k]=v.slice(0,500);}return next;
 }catch{return null;}
}
export function expectedShipLabel(value?:string|null,now=Date.now()){
 const date=value?.slice(0,10);if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return '출고 일정 확인 중';
 const today=new Date(now+9*3600_000).toISOString().slice(0,10);
 return date<today?'출고 일정 확인 중':`${date.replace(/-/g,'.')} 출고 예정`;
}
