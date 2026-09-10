import {NextResponse} from 'next/server';
import {currentSite} from '@/lib/site-server';
import {resolveCartItem,CartSelectionError} from '@/lib/cart-catalog';
export async function POST(req:Request){
 const b=await req.json().catch(()=>null);
 if(!Array.isArray(b?.items)||b.items.length>100)return NextResponse.json({error:'상품 목록을 확인해주세요.'},{status:400});
 const site=(await currentSite()).key;const items=[];
 try{for(const i of b.items){try{items.push(await resolveCartItem(i,site));}catch(error){if(!(error instanceof CartSelectionError))throw error;items.push({id:i?.id,unavailable:true,error:'가격·재고 또는 판매 기간을 확인해주세요.'});}}}
 catch{return NextResponse.json({error:'상품 조회에 실패했습니다. 다시 시도해주세요.'},{status:503});}
 return NextResponse.json({items},{headers:{'Cache-Control':'no-store'}});
}
