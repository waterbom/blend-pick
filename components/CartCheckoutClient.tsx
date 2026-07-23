"use client";

import { validateBuyerName } from "@/lib/validate-name";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import AddressSearchButton from "@/components/AddressSearchButton";
import { shopUnitPrice } from "@/lib/shop-price";

interface CartItem {
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
  is_addon?: boolean;
}

interface CartCheckoutData {
  items: CartItem[];
  totalAmount: number;
  shippingCost: number;
}

interface Props {
  clientKey: string;
}

export default function CartCheckoutClient({ clientKey }: Props) {
  const router = useRouter();
  const [checkoutData, setCheckoutData] = useState<CartCheckoutData | null>(null);
  const [loading, setLoading] = useState(false);
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

  // sessionStorage에서 장바구니 데이터 복원
  useEffect(() => {
    const raw = sessionStorage.getItem("cartCheckoutData");
    if (!raw) {
      router.replace("/cart");
      return;
    }
    const data: CartCheckoutData = JSON.parse(raw);
    if (!data.items || data.items.length === 0) {
      router.replace("/cart");
      return;
    }
    setCheckoutData(data);
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "sameAsBuyer" && checked) {
        next.shippingName = prev.customerName;
        next.shippingPhone = prev.customerPhone;
      }
      return next;
    });
  }

  async function handlePay() {
    if (!checkoutData) return;
    if (!form.customerName || !form.customerPhone) {
      alert("구매자 이름과 연락처를 입력해주세요.");
      return;
    }
      const nameError = validateBuyerName(form.customerName);
      if (nameError) { alert(nameError); return; }
    if (!form.shippingAddress || !form.shippingZipcode) {
      alert("배송지를 입력해주세요.");
      return;
    }
    setLoading(true);

    // Toss에 넘길 주문명: 대표 상품 + "외 N건"
    const firstItem = checkoutData.items[0];
    const orderName =
      checkoutData.items.length === 1
        ? firstItem.name
        : `${firstItem.name} 외 ${checkoutData.items.length - 1}건`;

    // confirm API에 넘길 전체 데이터를 sessionStorage에 업데이트
    const fullData = {
      ...checkoutData,
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

    const grandTotal = checkoutData.totalAmount + checkoutData.shippingCost;
    const orderId = crypto.randomUUID();

    try {
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
        customerMobilePhone: form.customerPhone.replace(/-/g, ""),
      });
    } catch (e) {
      console.error(e);
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
        불러오는 중...
      </div>
    );
  }

  const grandTotal = checkoutData.totalAmount + checkoutData.shippingCost;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-9">
      <div>
        <div className="ds-caption mb-2">CHECKOUT</div>
        <h1 className="ds-serif text-2xl font-semibold m-0" style={{ color: "#1C2418" }}>주문 / 결제</h1>
      </div>

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
                  className="w-12 h-12 rounded-xl overflow-hidden shrink-0"
                  style={{ background: "var(--cream-dark)" }}
                >
                  {item.main_image
                    ? <img src={item.main_image} alt={item.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                </div>
                <div className="flex-1 min-w-0">
                  {item.is_addon ? (
                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cream-dark)", color: "var(--text-muted)" }}>추가상품</span>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.brand}</p>
                  )}
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                  {item.option_value && (
                    <p className="text-xs" style={{ color: "var(--accent)" }}>
                      {item.option_name}: {item.option_value}
                    </p>
                  )}
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
              onSelect={(zip, addr) =>
                setForm((prev) => ({ ...prev, shippingZipcode: zip, shippingAddress: addr }))
              }
            />
            {form.shippingZipcode && (
              <p className="text-xs mt-1.5 tnum" style={{ color: "var(--text-muted)" }}>
                [{form.shippingZipcode}] {form.shippingAddress}
              </p>
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
            <select name="shippingMemo" value={form.shippingMemo} onChange={handleChange} className={inputClass} style={{ ...inputStyle, appearance: "auto" }}>
              <option value="">선택 안함</option>
              <option value="문 앞에 놔주세요">문 앞에 놔주세요</option>
              <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
              <option value="배송 전 연락 부탁드려요">배송 전 연락 부탁드려요</option>
            </select>
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
            <span className="ds-mono font-semibold">{checkoutData.totalAmount.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "#6B7263" }}>배송비</span>
            <span className="ds-mono font-semibold">{checkoutData.shippingCost === 0 ? "무료" : `${checkoutData.shippingCost.toLocaleString()}원`}</span>
          </div>
          </div>
          <div className="flex justify-between items-baseline px-6 py-4" style={{ background: "#F6F4EE", borderTop: "2px solid #244B1F" }}>
            <span className="text-xs" style={{ letterSpacing: "0.14em", color: "#7A8B6F" }}>총 결제 금액</span>
            <span className="font-bold text-2xl" style={{ color: "#1C2418" }}>{grandTotal.toLocaleString()}원</span>
          </div>
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="ds-btn ds-btn-primary w-full mt-3.5"
          style={{ height: "56px", fontSize: "15px" }}
        >
          {loading ? "처리 중..." : `${grandTotal.toLocaleString()}원 결제하기`}
        </button>
      </section>
    </div>
  );
}
