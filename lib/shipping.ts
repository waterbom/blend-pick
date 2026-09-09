// Shared delivery calculation. Regional tariffs are explicit merchant-configured postal ranges.
export interface ShippingRule {
  shipping_type: string;
  shipping_cost: number | null;
  free_shipping_threshold?: number | null;
  per_unit_shipping_cost?: number | null;
  supplier_name?: string | null;
  release_address?: string | null;
  shipping_carrier?: string | null;
  island_shipping_cost?: number | null;
  remote_zipcodes?: string | null;
  installation_cost?: number | null;
}
export function postalRanges(value:string):[string,string][] {
  if(!value.trim()) return [];
  if(value.length>12000)throw Error('추가 배송 지역은 12,000자 이내로 입력해주세요.');
  return value.trim().split(/[\s,;]+/).map(part=>{
    const m=/^(\d{5})(?:-(\d{5}))?$/.exec(part);
    if(!m||m[1]>(m[2]||m[1]))throw Error('추가 배송 지역은 5자리 우편번호 또는 시작-종료 범위로 입력해주세요.');
    return [m[1],m[2]||m[1]];
  });
}
export function regionalShippingFee(r:ShippingRule,zipcode?:string):number {
  const cost=Number(r.island_shipping_cost)||0;
  if(!cost)return 0;
  const ranges=postalRanges(r.remote_zipcodes||'');
  if(!ranges.length)return 0; // Optional region configuration: do not guess a surcharge destination.
  if(!zipcode)return 0; // Product-page estimate only; payment verification requires a destination.
  if(!/^\d{5}$/.test(zipcode))throw Error('주소 검색으로 배송지를 다시 선택해주세요.');
  return ranges.some(([a,b])=>zipcode>=a&&zipcode<=b)?cost:0;
}
export function productShippingFee(r:ShippingRule,qty:number,subtotal:number):number {
  const cost=Number(r.shipping_cost)||0;
  switch(r.shipping_type){
    case 'free':return 0;
    case 'conditional_free':return Number(r.free_shipping_threshold)>0&&subtotal>=Number(r.free_shipping_threshold)?0:cost;
    case 'per_unit':return Math.max(0,qty-1)*(Number(r.per_unit_shipping_cost)||0);
    default:return cost;
  }
}
export function shippingLabel(r:ShippingRule):string {
  const cost=Number(r.shipping_cost)||0,th=Number(r.free_shipping_threshold)||0;
  const base=r.shipping_type==='free'?'무료배송':r.shipping_type==='conditional_free'&&th>0?`${th.toLocaleString()}원 이상 무료배송 (미만 ${cost.toLocaleString()}원)`:r.shipping_type==='per_unit'?`1건 무료배송 · 2건째부터 건당 ${(Number(r.per_unit_shipping_cost)||0).toLocaleString()}원`:`배송비 ${cost.toLocaleString()}원`;
  return base+(Number(r.island_shipping_cost)>0?` · 지정 지역 추가 ${Number(r.island_shipping_cost).toLocaleString()}원`:'')+(Number(r.installation_cost)>0?` · 설치비 개당 ${Number(r.installation_cost).toLocaleString()}원`:'');
}
export interface CartFeeItem extends ShippingRule {product_id:string;quantity:number;unit_price:number;}
const norm=(v:string|null|undefined)=>(v||'').trim().replace(/\s+/g,' ');
function shippingGroup(r:CartFeeItem):string {
  const parts=[norm(r.supplier_name),norm(r.release_address),norm(r.shipping_carrier)];
  return parts.every(Boolean)?JSON.stringify(parts):'product:'+r.product_id;
}
export function cartShippingBreakdown(items:CartFeeItem[],zipcode?:string){
  const products=new Map<string,{rule:CartFeeItem;qty:number;subtotal:number}>();
  for(const it of items){const g=products.get(it.product_id)||{rule:it,qty:0,subtotal:0};g.qty+=it.quantity;g.subtotal+=it.unit_price*it.quantity;products.set(it.product_id,g);}
  const bundles=new Map<string,{flat:number;perUnit:number;regional:number}>();
  for(const g of products.values()){
    const key=shippingGroup(g.rule),b=bundles.get(key)||{flat:0,perUnit:0,regional:0};
    const fee=productShippingFee(g.rule,g.qty,g.subtotal);
    if(g.rule.shipping_type==='per_unit')b.perUnit+=fee;else b.flat=Math.max(b.flat,fee);
    b.regional=Math.max(b.regional,regionalShippingFee(g.rule,zipcode));bundles.set(key,b);
  }
  const base=[...bundles.values()].reduce((n,b)=>n+b.flat+b.perUnit,0),regional=[...bundles.values()].reduce((n,b)=>n+b.regional,0);
  return {base,regional,total:base+regional,bundles:bundles.size};
}
export function cartShippingFee(items:CartFeeItem[],zipcode?:string):number{return cartShippingBreakdown(items,zipcode).total;}
