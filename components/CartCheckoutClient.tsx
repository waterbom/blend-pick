"use client";

import { useShippingQuote } from "@/lib/use-shipping-quote";
import ShippingQuoteSummary from "@/components/ShippingQuoteSummary";
import { validateBuyerName } from "@/lib/validate-name";
import { tossMobilePhone, payErrorMessage } from "@/lib/pay-utils";
import CheckoutItemEditor from "@/components/CheckoutItemEditor";
import { CHECKOUT_DRAFT_KEY,restoreCheckoutForm,expectedShipLabel } from "@/lib/checkout-draft";
import { useEffect, useState } from "react";
import { optionText } from "@/lib/buyer-flow";
import { useRouter } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import AddressSearchButton from "@/components/AddressSearchButton";
import PhoneVerifyField from "@/components/PhoneVerifyField";
import PrivacyConsent from "@/components/PrivacyConsent";
import { shopUnitPrice } from "@/lib/shop-price";
import DsSelect from "@/components/DsSelect";
import RollingWon from "@/components/RollingWon";

export interface CartItem {
  expected_ship_date?:string|null;
  availableOptions?:{id:string;name:string;value:string;price:number;stock:number}[];
  id: string;
  quantity: number;
  product_id: string | null;
  name: string;
  brand: string;
  price: number;
  main_image: string | null;
  shipping_type: string;
  shipping_cost: number;
  status: string;
  stock: number;
  option_id: string | null;
  option_name: string | null;
  option_value: string | null;
  extra_price: number | null;
  is_addon?: boolean; link_code?: string | null;
}

export interface CartCheckoutData {
  fromCart?:boolean; influencerId?:string|null; linkCode?:string|null; guestCartSite?:string; guestCartIds?:string[];
  items: CartItem[];
  totalAmount: number;
  shippingCost: number;
}

interface Props {
  initialData?:CartCheckoutData;
  clientKey: string;
  phoneVerifyRequired?: boolean; // 비회원이면 휴대폰 인증 후 결제
}

export default function CartCheckoutClient({ clientKey, phoneVerifyRequired = false, initialData }: Props) {
  const router = useRouter();
  const [checkoutData, setCheckoutData] = useState<CartCheckoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [draftReady,setDraftReady]=useState(false);
  const [draftNotice,setDraftNotice]=useState('');
  const [editing,setEditing]=useState(false);
  const [catalogError,setCatalogError]=useState('');
  const [catalogReady,setCatalogReady]=useState(false);
  const [dirtyItems,setDirtyItems]=useState<Record<string,boolean>>({});
  const hasPendingEdits=Object.values(dirtyItems).some(Boolean);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    shippingName: "",
    shippingPhone: "",
    shippingZipcode: "",
    shippingAddress: "",
    shippingAddress2: "",
    shippingMemo: "",
    sameAsBuyer: false,
  });
  const quoteItems=(checkoutData?.items||[]).map(i=>({product_id:i.product_id,option_id:i.option_id,quantity:i.quantity,price:i.price,is_addon:i.is_addon,name:i.name,link_code:i.link_code}));
  const expectedGoods=(checkoutData?.items||[]).reduce((n,i)=>n+shopUnitPrice(i.price,i.extra_price,i.option_id!=null)*i.quantity,0);
  const delivery=useShippingQuote(quoteItems,form.shippingZipcode,expectedGoods);
  const [memoCustom, setMemoCustom] = useState(false); // 배송 메모 "직접 입력" 모드
  // 필드별 인라인 에러 — alert 대신 해당 입력 아래 표시하고 첫 에러로 스크롤
  const [errors, setErrors] = useState<Record<string, string>>({});
  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    let active=true;
    setCatalogReady(false);setCatalogError('');
    try{
      const raw=initialData?JSON.stringify(initialData):sessionStorage.getItem('cartCheckoutData');
      const data:CartCheckoutData=JSON.parse(raw||'null');
      if(!data?.items?.length){router.replace('/cart');return;}
      setCheckoutData(data);
      const restored=restoreCheckoutForm(sessionStorage.getItem(CHECKOUT_DRAFT_KEY),form);
      if(restored){setForm(restored);setMemoCustom(!!restored.shippingMemo);setDraftNotice('입력하던 배송정보를 복원했습니다. 연락처 인증과 동의는 다시 확인해주세요.');}
      setDraftReady(true);
      const mains=data.items.filter(i=>!i.is_addon);
      fetch('/api/cart/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:mains})}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(result=>{
        if(!active)return;
        if(result.items.some((i:any)=>i.unavailable))throw Error();
        const items=data.items.map(i=>i.is_addon?i:{...i,...result.items.find((r:any)=>r.id===i.id)});
        const next={...data,items};setCheckoutData(next);sessionStorage.setItem('cartCheckoutData',JSON.stringify(next));setCatalogReady(true);
      }).catch(()=>{if(active)setCatalogError('현재 가격·재고를 확인하지 못했습니다. 장바구니나 상품 상세에서 다시 확인해주세요.');});
    }catch{setCatalogError('주문 정보를 불러오지 못했습니다. 장바구니에서 다시 주문해주세요.');}
    return()=>{active=false;};
  }, [router,initialData]);
  useEffect(()=>{
    if(!draftReady)return;
    try{sessionStorage.setItem(CHECKOUT_DRAFT_KEY,JSON.stringify({at:Date.now(),form}));}catch{setDraftNotice('이 브라우저에서는 임시저장이 지원되지 않습니다.');}
  },[form,draftReady]);
  async function editItem(item:CartItem,option_id:string|null,quantity:number){
    if(!checkoutData||editing||loading)return;
    setEditing(true);setCatalogError('');
    try{
      const r=await fetch('/api/cart/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{...item,option_id,quantity}]})});
      const d=await r.json();if(!r.ok||d.items?.[0]?.unavailable)throw Error('선택한 옵션의 판매 상태와 수량을 확인해주세요.');
      const next={...checkoutData,items:checkoutData.items.map(i=>i.id===item.id?{...i,...d.items[0]}:i)};
      setCheckoutData(next);sessionStorage.setItem('cartCheckoutData',JSON.stringify(next));setDirtyItems(prev=>({...prev,[item.id]:false}));
    }catch(e){setCatalogError((e as Error).message);}finally{setEditing(false);}
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    clearError(name);
    if(name==="customerPhone")setPhoneVerified(false);
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if ((name === "sameAsBuyer" && checked) || (prev.sameAsBuyer && (name === "customerName" || name === "customerPhone"))) {
        next.shippingName = next.customerName;
        next.shippingPhone = next.customerPhone;
      }
      return next;
    });
  }

  async function handlePay() {
    if (!checkoutData || !delivery.ready || !catalogReady || editing || loading || catalogError || hasPendingEdits) return;

    // 검증 — alert 대신 필드별 인라인 에러로 모아 보여주고 첫 에러로 스크롤
    const errs: Record<string, string> = {};
    if (!form.customerName) errs.customerName = "이름을 입력해주세요.";
    else {
      const nameError = validateBuyerName(form.customerName);
      if (nameError) errs.customerName = nameError;
    }
    if (!form.customerPhone) errs.customerPhone = "연락처를 입력해주세요.";
    if (phoneVerifyRequired && !phoneVerified) errs.phoneVerify = "비회원 주문은 휴대폰 인증 후 결제할 수 있어요.";
    if (!form.shippingAddress || !form.shippingZipcode) errs.shippingAddress = "주소 검색으로 배송지를 입력해주세요.";
    if (!privacyAgreed) errs.privacy = "개인정보 수집·이용에 동의해주세요.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() => {
        document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setLoading(true);

    try{
    const fresh=await delivery.refresh();
    if(fresh.totalAmount!==delivery.quote!.totalAmount||fresh.shippingCost!==delivery.quote!.shippingCost||fresh.installationCost!==delivery.quote!.installationCost){setErrors(p=>({...p,pay:"배송·설치비가 변경되었습니다. 갱신된 금액을 확인하고 다시 결제해주세요."}));setLoading(false);return;}
    // Toss에 넘길 주문명: 대표 상품 + "외 N건"
    const firstItem = checkoutData.items[0];
    const orderName =
      checkoutData.items.length === 1
        ? firstItem.name
        : `${firstItem.name} 외 ${checkoutData.items.length - 1}건`;

    // confirm API에 넘길 전체 데이터를 sessionStorage에 업데이트
    const fullData = {
      ...checkoutData,
      shippingCost:fresh.shippingCost, totalAmount:fresh.goodsAmount+fresh.installationCost,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      shippingName: form.shippingName || form.customerName,
      shippingPhone: form.shippingPhone || form.customerPhone,
      shippingZipcode: form.shippingZipcode,
      shippingAddress: form.shippingAddress,
      shippingAddress2: form.shippingAddress2,
      shippingMemo: form.shippingMemo,
      orderName,
      isCartOrder: true,
    };
    sessionStorage.setItem("cartCheckoutData", JSON.stringify(fullData));

    const grandTotal = fresh.totalAmount;
    const orderId = crypto.randomUUID();

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: "ANONYMOUS" });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: grandTotal },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/checkout/cart-success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: form.customerName,
        customerEmail: form.customerEmail || undefined,
        customerMobilePhone: tossMobilePhone(form.customerPhone),
      });
    } catch (e) {
      // 결제창을 못 연 이유를 버튼 아래에 표시 (창 닫기 취소는 조용히 무시)
      console.error(e);
      const msg = payErrorMessage(e);
      if (msg) setErrors((prev) => ({ ...prev, pay: msg }));
      setLoading(false);
    }
  }

  const inputClass = "ds-input";
  const inputStyle = {};
  const focusOn = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "#244B1F");
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "#E4E1D6");

  if (!checkoutData) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: "var(--text-muted)" }}>
        {catalogError || "불러오는 중..."}
        {catalogError&&<a href="/cart" className="underline block mt-3">장바구니로 돌아가기</a>}
      </div>
    );
  }

  const grandTotal = delivery.quote?.totalAmount ?? expectedGoods;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-9">
      <div>
        <div className="ds-caption mb-2">CHECKOUT</div>
        <h1 className="ds-serif text-2xl font-semibold m-0" style={{ color: "#1C2418" }}>주문 / 결제</h1>
      </div>

      {draftNotice&&<p role="status" className="text-sm">{draftNotice}</p>}
      {draftReady&&<p className="text-xs">배송정보는 이 탭에 30분간 임시저장됩니다. <button type="button" className="underline" onClick={()=>{sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);setForm(prev=>Object.fromEntries(Object.entries(prev).map(([k,v])=>[k,typeof v==='boolean'?false:''])) as typeof prev);setPhoneVerified(false);setPrivacyAgreed(false);setDraftNotice('저장된 배송정보를 지웠습니다.');}}>저장된 정보 지우기</button></p>}
      {catalogError&&<p role="alert" className="text-sm text-red-700">{catalogError} <a href="/cart" className="underline">장바구니 확인</a></p>}
      {hasPendingEdits&&<p role="status" className="text-sm">수정한 옵션·수량을 적용하거나 취소한 뒤 결제해주세요.</p>}
      {/* 상품 목록 요약 */}
      <section>
        <div className="ds-section-title">
          <span>주문 상품 <span className="ds-mono text-[13px] font-medium" style={{ color: "#7A8B6F" }}>{checkoutData.items.length}건</span></span>
        </div>
        <div className="space-y-3 pt-5">
          {checkoutData.items.map((item) => {
            const unitPrice = shopUnitPrice(item.price, item.extra_price, item.option_id != null);
            return (
              <div key={item.id} className="flex gap-3 items-center">
                <div
                  className="w-12 h-12 overflow-hidden shrink-0"
                  style={{ border: "1px solid #E4E1D6", background: "var(--cream-dark)" }}
                >
                  {item.main_image
                    ? <img src={item.main_image} alt={item.name} className="w-full h-full object-contain" />
                    : <div className="w-full h-full" style={{ background: "repeating-linear-gradient(45deg,#F6F4EE 0 8px,#EDEAE0 8px 16px)" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  {item.is_addon ? (
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cream-dark)", color: "var(--text-muted)" }}>추가상품</span>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.brand}</p>
                  )}
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                  {!item.is_addon&&<p className="text-xs">{expectedShipLabel(item.expected_ship_date)}</p>}
                  {item.option_value && (
                    <p className="text-xs" style={{ color: "var(--accent)" }}>
                      {optionText(item.option_name, item.option_value)}
                    </p>
                  )}
                  {!item.is_addon&&<CheckoutItemEditor key={`${item.id}:${item.option_id}:${item.quantity}`} item={item} onDirty={dirty=>{setDirtyItems(prev=>({...prev,[item.id]:dirty}));if(!dirty)setCatalogError('');}} disabled={editing||loading||!catalogReady} onApply={(option,q)=>editItem(item,option,q)}/>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {(unitPrice * item.quantity).toLocaleString()}원
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>수량 {item.quantity}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 구매자 정보 */}
      <section>
        <div className="ds-section-title">구매자 정보</div>
        <div className="space-y-3.5 pt-5">
          {[
            { name: "customerName", label: "이름 *", placeholder: "홍길동" },
            { name: "customerPhone", label: "연락처 *", placeholder: "010-0000-0000" },
            { name: "customerEmail", label: "이메일 (선택)", placeholder: "example@email.com" },
          ].map(({ name, label, placeholder }) => (
            <div key={name}>
              <label className="ds-label">{label}</label>
              <input
                name={name}
                value={(form as any)[name]}
                onChange={handleChange}
                placeholder={placeholder}
                className={inputClass}
                style={inputStyle}
                onFocus={focusOn}
                onBlur={focusOff}
              />
              {errors[name] && (
                <p data-field-error className="mt-1.5 text-xs" style={{ color: "#B4423C" }}>{errors[name]}</p>
              )}
              {name === "customerPhone" && phoneVerifyRequired && (
                <>
                  <PhoneVerifyField key={form.customerPhone} phone={form.customerPhone} verified={phoneVerified}
                    onVerified={() => { setPhoneVerified(true); clearError("phoneVerify"); }} />
                  {errors.phoneVerify && (
                    <p data-field-error className="mt-1.5 text-xs" style={{ color: "#B4423C" }}>{errors.phoneVerify}</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 배송지 정보 */}
      <section>
        <div className="ds-section-title">
          <span>배송 정보</span>
          <label className="flex items-center gap-1.5 text-xs font-sans cursor-pointer tracking-normal" style={{ color: "#2D5A27", fontWeight: 600 }}>
            <input type="checkbox" name="sameAsBuyer" checked={form.sameAsBuyer} onChange={handleChange} />
            구매자 정보와 동일
          </label>
        </div>
        <div className="space-y-3.5 pt-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "shippingName", label: "받는 분 *", placeholder: "홍길동" },
              { name: "shippingPhone", label: "연락처 *", placeholder: "010-0000-0000" },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="ds-label">{label}</label>
                <input
                  name={name}
                  value={(form as any)[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
            ))}
          </div>
          <div>
            <AddressSearchButton
              onSelect={(zip, addr) => {
                clearError("shippingAddress");
                setForm((prev) => ({ ...prev, shippingZipcode: zip, shippingAddress: addr }));
              }}
            />
            {form.shippingZipcode && (
              <p className="text-xs mt-1.5 tnum" style={{ color: "var(--text-muted)" }}>
                [{form.shippingZipcode}] {form.shippingAddress}
              </p>
            )}
            {errors.shippingAddress && (
              <p data-field-error className="mt-1.5 text-xs" style={{ color: "#B4423C" }}>{errors.shippingAddress}</p>
            )}
          </div>
          <div style={{ display: "none" }}>
            <input name="shippingZipcode" value={form.shippingZipcode} onChange={handleChange} readOnly />
            <input name="shippingAddress" value={form.shippingAddress} onChange={handleChange} readOnly />
          </div>
          <div>
            <label className="ds-label">상세주소</label>
            <input name="shippingAddress2" value={form.shippingAddress2} onChange={handleChange} placeholder="101동 101호" className={inputClass} style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
          </div>
          <div>
            <label className="ds-label">배송 메모</label>
            <DsSelect
              value={memoCustom ? "__custom__" : form.shippingMemo}
              options={[
                { value: "", label: "선택 안함" },
                { value: "문 앞에 놔주세요", label: "문 앞에 놔주세요" },
                { value: "경비실에 맡겨주세요", label: "경비실에 맡겨주세요" },
                { value: "배송 전 연락 부탁드려요", label: "배송 전 연락 부탁드려요" },
                { value: "__custom__", label: "직접 입력" },
              ]}
              onChange={(v) => {
                if (v === "__custom__") { setMemoCustom(true); setForm((p) => ({ ...p, shippingMemo: "" })); }
                else { setMemoCustom(false); setForm((p) => ({ ...p, shippingMemo: v })); }
              }}
            />
            {memoCustom && (
              <input name="shippingMemo" value={form.shippingMemo} onChange={handleChange}
                placeholder="배송 메모를 입력해주세요 (예: 부재 시 문 앞)" maxLength={100}
                className={`${inputClass} mt-2`} style={inputStyle} />
            )}
          </div>
        </div>
      </section>

      {/* 결제 금액 요약 */}
      <section>
        <div className="ds-card">
          <div className="px-6 py-5 ds-serif font-semibold text-base" style={{ borderBottom: "1px solid #E4E1D6", color: "#1C2418" }}>
            결제 금액
          </div>
          <div className="px-6 py-5 flex flex-col gap-3 text-[13px]">
          <div className="flex justify-between">
            <span style={{ color: "#6B7263" }}>상품 금액</span>
            <span className="ds-mono font-semibold">{expectedGoods.toLocaleString()}원</span>
          </div>
          <ShippingQuoteSummary quote={delivery.quote} error={delivery.error} retry={()=>{void delivery.refresh().catch(()=>{});}} />
          </div>
          <div className="flex items-center justify-between px-6 py-5" style={{ background: "#1C2418" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500,
              letterSpacing: "0.3em", color: "#9FBF93" }}>TOTAL — 총 결제 금액</span>
            {delivery.ready?<RollingWon value={grandTotal} size={28} />:<span className="text-white text-sm">배송지 확인 후 확정</span>}
          </div>
        </div>
        <div className="mt-3.5">
          <PrivacyConsent checked={privacyAgreed} onChange={(v) => { setPrivacyAgreed(v); if (v) clearError("privacy"); }} />
          {errors.privacy && (
            <p data-field-error className="mt-1.5 text-xs" style={{ color: "#B4423C" }}>{errors.privacy}</p>
          )}
        </div>
        <button
          onClick={handlePay}
          disabled={loading || editing || !catalogReady || !!catalogError || hasPendingEdits || !delivery.ready}
          className="ds-btn ds-btn-primary w-full mt-3.5"
          style={{ height: "56px", fontSize: "15px" }}
        >
          {loading ? "처리 중..." : !delivery.ready?"배송비 확인 대기":`${grandTotal.toLocaleString()}원 결제하기`}
        </button>
        {errors.pay && (
          <p className="mt-2 text-xs text-center" style={{ color: "#B4423C" }}>{errors.pay}</p>
        )}
      </section>
    </div>
  );
}
