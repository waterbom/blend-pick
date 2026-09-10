"use client";
import {useMemo} from 'react';
import CartCheckoutClient, {type CartCheckoutData} from '@/components/CartCheckoutClient';
interface Props {
  productId: string;
  productName: string;
  optionId: string | null;
  optionLabel: string | null;
  unitPrice: number;
  quantity: number;
  shippingCost: number;
  totalAmount: number;
  orderName: string;
  clientKey: string;
  phoneVerifyRequired?: boolean; // 비회원이면 휴대폰 인증 후 결제
  influencerId?: string | null;
  linkCode?: string | null; // 비밀링크(?k=)로 들어온 결제 — 서버가 검증한 코드만 전달됨
}
export default function ShopCheckoutClient(p:Props){
 const initialData=useMemo<CartCheckoutData>(()=>({fromCart:false,influencerId:p.influencerId,linkCode:p.linkCode,totalAmount:p.unitPrice*p.quantity,shippingCost:p.shippingCost,items:[{id:`single:${p.productId}`,product_id:p.productId,name:p.productName,brand:'',price:p.unitPrice,main_image:null,shipping_type:'free',shipping_cost:0,status:'active',stock:-1,option_id:p.optionId,option_name:null,option_value:p.optionLabel,extra_price:p.optionId?p.unitPrice:null,quantity:p.quantity,link_code:p.linkCode}]}),[p.productId,p.optionId,p.quantity,p.unitPrice,p.shippingCost,p.influencerId,p.linkCode,p.productName,p.optionLabel]);
 return <CartCheckoutClient initialData={initialData} clientKey={p.clientKey} phoneVerifyRequired={p.phoneVerifyRequired}/>;
}
