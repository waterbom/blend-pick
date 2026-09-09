import {NextResponse} from 'next/server';
import {currentSite} from '@/lib/site-server';
import {quoteCartAmount} from '@/lib/order-amount';
export async function POST(req:Request){
  const b=await req.json().catch(()=>null);
  if(!b||!Array.isArray(b.items)||!b.items.length||b.items.length>100||!/^\d{5}$/.test(b.shippingZipcode||''))return NextResponse.json({error:'상품과 배송지를 확인해주세요.'},{status:400});
  try{
    const result=await quoteCartAmount({site:(await currentSite()).key,items:b.items,shippingZipcode:b.shippingZipcode,totalAmount:0,shippingCost:0,amount:0});
    if(!result.ok)return NextResponse.json({error:result.error},{status:400});
    return NextResponse.json(result.quote,{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'배송비를 확인하지 못했습니다. 다시 시도해주세요.'},{status:503});}
}
