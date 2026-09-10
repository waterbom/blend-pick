import type { SiteKey } from './sites';
export interface GuestItem { id:string; product_id:string; option_id:string|null; quantity:number; name:string; [key:string]:unknown }
const TTL=7*86400_000;
const key=(site:SiteKey)=>`guest-cart:v1:${site}`;
export function readGuestCart(site:SiteKey):GuestItem[]{
  try{const d=JSON.parse(localStorage.getItem(key(site))||'null');if(!d||Date.now()-d.at>TTL||!Array.isArray(d.items))return [];return d.items.filter((i:GuestItem)=>i&&typeof i.id==='string'&&typeof i.product_id==='string'&&Number.isSafeInteger(i.quantity)&&i.quantity>0).slice(0,30);}catch{return [];}
}
export function writeGuestCart(site:SiteKey,items:GuestItem[]){localStorage.setItem(key(site),JSON.stringify({at:Date.now(),items}));window.dispatchEvent(new Event('cart-change'));}
export function addGuestItems(site:SiteKey,items:Omit<GuestItem,'id'>[]){
  // Each addition is an immutable import entry: retries across tabs reuse the same id.
  const next=[...readGuestCart(site),...items.map(i=>({...i,id:crypto.randomUUID()} as GuestItem))];
  if(next.length>30)throw Error('장바구니는 최대 30개 항목까지 담을 수 있습니다.');
  writeGuestCart(site,next);
}
export function removeGuestItems(site:SiteKey,ids:string[]){writeGuestCart(site,readGuestCart(site).filter(i=>!ids.includes(i.id)));}
export class GuestMergeError extends Error {constructor(message:string,public reconciled:boolean){super(message);}}
export async function mergeGuestCart(site:SiteKey){
  const items=readGuestCart(site);if(!items.length)return;
  const r=await fetch('/api/cart/merge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});
  const d=await r.json();if(!r.ok){const reconciled=d.rolledBack===true&&Array.isArray(d.importedIds);if(reconciled)removeGuestItems(site,d.importedIds);throw new GuestMergeError(d.error||'비회원 장바구니를 합치지 못했습니다. 다시 시도해주세요.',reconciled);}
  removeGuestItems(site,items.map(i=>i.id));
}
