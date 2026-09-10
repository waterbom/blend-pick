"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { shopUnitPrice } from "@/lib/shop-price";
import { GuestMergeError,readGuestCart,writeGuestCart,removeGuestItems,mergeGuestCart, type GuestItem } from "@/lib/guest-cart";
import { useSiteKey } from "@/components/SiteContext";
import { optionText } from "@/lib/buyer-flow";
import { cartShippingFee } from "@/lib/shipping";

interface CartItem {
  id: string;
  quantity: number;
  product_id: string;
  name: string;
  brand: string;
  price: number;
  main_image: string | null;
  supplier_name?:string|null;release_address?:string|null;shipping_carrier?:string|null;
  shipping_type: string;
  shipping_cost: number;
  free_shipping_threshold: number | null;
  per_unit_shipping_cost: number | null;
  status: string;
  stock: number;
  option_id: string | null;
  option_name: string | null;
  option_value: string | null;
  extra_price: number | null;
}

export default function CartClient() {
  const router = useRouter();
  const site = useSiteKey();
  const [guest,setGuest]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [mergeNotice,setMergeNotice]=useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCart() {
    setError("");setMergeNotice('');setLoading(true);
    try{
      let res=await fetch('/api/cart');
      const isGuest=res.status===401;setGuest(isGuest);
      let rows:CartItem[];
      if(isGuest)rows=readGuestCart(site) as unknown as CartItem[];
      else{
        if(!res.ok)throw Error('장바구니를 불러오지 못했습니다.');
        let unmerged=false;
        try{await mergeGuestCart(site);}catch(e){if(!(e instanceof GuestMergeError)||!e.reconciled)throw e;unmerged=true;setGuest(true);setMergeNotice('합치지 못한 비회원 항목입니다. 수량을 줄이거나 삭제한 뒤 다시 합쳐주세요. 기존 회원 장바구니는 유지됩니다.');}
        if(unmerged)rows=readGuestCart(site) as unknown as CartItem[];
        else{res=await fetch('/api/cart');if(!res.ok)throw Error('장바구니를 불러오지 못했습니다.');rows=(await res.json()).items||[];}
      }
      if(rows.length){
        const resolved=await fetch('/api/cart/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:rows})});
        if(!resolved.ok)throw Error('현재 가격과 재고를 확인하지 못했습니다.');
        const current=(await resolved.json()).items;
        rows=rows.map((i,n)=>current[n]?.unavailable?{...i,status:'soldout',stock:0}:{...i,...current[n]});
      }
      setItems(rows);
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  useEffect(()=>{fetchCart();},[site]);
  async function change(cartId:string,quantity:number|null){
    if(busy)return;setBusy(true);setError('');
    try{
      if(guest){
        if(quantity===null)removeGuestItems(site,[cartId]);
        else writeGuestCart(site,readGuestCart(site).map(i=>i.id===cartId?{...i,id:crypto.randomUUID(),quantity}:i));
      }else{
        const res=await fetch('/api/cart',{method:quantity===null?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({cart_id:cartId,quantity})});
        if(!res.ok)throw Error('변경하지 못했습니다. 다시 시도해주세요.');
      }
      await fetchCart();window.dispatchEvent(new Event('cart-change'));
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const updateQty=(id:string,q:number)=>change(id,q);
  const removeItem=(id:string)=>change(id,null);

  const availableItems = items.filter((i) => i.status !== "soldout" && i.stock !== 0);
  const totalAmount = availableItems.reduce((sum, i) => {
    return sum + shopUnitPrice(i.price, i.extra_price, i.option_id != null) * i.quantity;
  }, 0);
  // 배송비 — 상품별 어드민 설정 반영 (건별 배송비는 같은 상품 수량 합산으로 2개째부터 추가)
  const shippingCost = cartShippingFee(
    availableItems.map((i) => ({
      product_id: i.product_id, supplier_name:i.supplier_name,release_address:i.release_address,shipping_carrier:i.shipping_carrier,
      quantity: i.quantity,
      unit_price: shopUnitPrice(i.price, i.extra_price, i.option_id != null),
      shipping_type: i.shipping_type,
      shipping_cost: i.shipping_cost,
      free_shipping_threshold: i.free_shipping_threshold,
      per_unit_shipping_cost: i.per_unit_shipping_cost,
    }))
  );

  if (loading) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: "var(--text-muted)" }}>
        불러오는 중...
      </div>
    );
  }

  if (error) return <div className="p-8" role="alert">{error}<button onClick={fetchCart} className="underline ml-3">다시 시도</button>{readGuestCart(site).length>0&&<button className="underline ml-3" onClick={()=>{writeGuestCart(site,[]);fetchCart();}}>비회원 보관 항목 비우기</button>}</div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-32">
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>장바구니가 비어있습니다</p>
        <Link href="/products" className="text-sm font-medium underline underline-offset-4" style={{ color: "var(--accent)" }}>
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>
        장바구니 <span className="text-base font-medium" style={{ color: "var(--text-muted)" }}>({items.length})</span>
      </h1>

      {mergeNotice&&<p role="status" className="mb-3 text-sm">{mergeNotice} <button onClick={fetchCart} className="underline">다시 합치기</button></p>}
      {guest&&<p className="mb-4 text-sm">로그인 없이 주문할 수 있습니다. 담은 상품은 이 브라우저에 7일간 보관되며 로그인 후 장바구니에서 합쳐집니다.</p>}
      <div className="space-y-3 mb-6">
        {items.map((item) => {
          const unitPrice = shopUnitPrice(item.price, item.extra_price, item.option_id != null);
          const isSoldout = item.status === "soldout" || item.stock === 0;
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 flex gap-4"
              style={{ border: "1px solid var(--line)", opacity: isSoldout ? 0.5 : 1 }}
            >
              <Link href={`/products/${item.product_id}`} className="shrink-0">
                <div className="w-16 h-16 rounded-xl overflow-hidden" style={{ background: "var(--cream-dark)" }}>
                  {item.main_image
                    ? <img src={item.main_image} alt={item.name} className="w-full h-full object-contain" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">📦</div>}
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{item.brand}</p>
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                {item.option_value && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>
                    {optionText(item.option_name,item.option_value)}
                  </p>
                )}
                {isSoldout && (
                  <p className="text-xs mt-0.5 font-medium text-red-400">판매 상태·수량 확인 필요</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  {/* 수량 조절 */}
                  {(
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                      <button
                        disabled={busy} onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-50 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >−</button>
                      <span className="w-7 text-center text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.quantity}
                      </span>
                      <button
                        disabled={busy} onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-50 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >+</button>
                    </div>
                  )}
                  {isSoldout && <div />}

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {(unitPrice * item.quantity).toLocaleString()}원
                    </span>
                    <button
                      disabled={busy} onClick={() => removeItem(item.id)}
                      className="text-xs transition-colors hover:text-red-400"
                      style={{ color: "var(--text-muted)" }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 결제 요약 */}
      <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
        <div className="space-y-2.5 text-sm mb-5 tnum" style={{ color: "var(--text-secondary)" }}>
          <div className="flex justify-between">
            <span>상품 금액</span>
            <span>{totalAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span>기본 배송비 (지역 추가비·설치비 별도)</span>
            <span>{shippingCost === 0 ? "무료" : `${shippingCost.toLocaleString()}원`}</span>
          </div>
          <div
            className="flex justify-between items-baseline pt-3"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>예상 금액 · 배송지 입력 후 확정</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{(totalAmount + shippingCost).toLocaleString()}원</span>
          </div>
        </div>

        {availableItems.length === 0 ? (
          <p className="text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>
            구매 가능한 상품이 없습니다
          </p>
        ) : (
          <button
            className="w-full text-white font-bold py-3.5 rounded-2xl text-sm transition-all hover:brightness-95"
            style={{ background: "var(--accent)" }}
            onClick={() => {
              sessionStorage.setItem(
                "cartCheckoutData",
                JSON.stringify({
                  fromCart:!guest, guestCartSite:guest?site:undefined, guestCartIds:guest?availableItems.map(i=>i.id):undefined, items: availableItems,
                  totalAmount,
                  shippingCost,
                })
              );
              router.push("/cart/checkout");
            }}
          >
            배송지 입력·결제 ({(totalAmount + shippingCost).toLocaleString()}원)
          </button>
        )}

        <Link
          href="/products"
          className="block text-center text-sm mt-3 py-2"
          style={{ color: "var(--text-muted)" }}
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}
