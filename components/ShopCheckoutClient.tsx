"use client";

import { validateBuyerName } from "@/lib/validate-name";
import { tossMobilePhone, payErrorMessage } from "@/lib/pay-utils";
import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import PhoneVerifyField from "@/components/PhoneVerifyField";
import PrivacyConsent from "@/components/PrivacyConsent";
import AddressSearchButton from "@/components/AddressSearchButton";

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
}

export default function ShopCheckoutClient({
  influencerId,
  productId,
  productName,
  optionId,
  optionLabel,
  unitPrice,
  quantity,
  shippingCost,
  totalAmount,
  orderName,
  clientKey,
  phoneVerifyRequired = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
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
    if (!privacyAgreed) {
      alert("개인정보 수집·이용에 동의해주세요.");
      return;
    }
    if (phoneVerifyRequired && !phoneVerified) {
      alert("비회원 주문은 휴대폰 인증 후 결제할 수 있어요.");
      return;
    }
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

    const checkoutData = {
      influencerId: influencerId ?? null, // 인플루언서 귀속 (결제 승인 시 서버가 검증 후 도장)
      productId,
      productName,
      optionId,
      optionLabel: optionLabel || null,
      unitPrice,
      quantity,
      shippingCost,
      totalAmount,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      shippingName: form.shippingName || form.customerName,
      shippingPhone: form.shippingPhone || form.customerPhone,
      shippingZipcode: form.shippingZipcode,
      shippingAddress: form.shippingAddress,
      shippingAddress2: form.shippingAddress2,
      shippingMemo: form.shippingMemo,
      isShopOrder: true,
    };
    sessionStorage.setItem("checkoutData", JSON.stringify(checkoutData));

    const orderId = crypto.randomUUID();

    try {
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: "ANONYMOUS" });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: totalAmount },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/checkout/shop-success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: form.customerName,
        customerEmail: form.customerEmail || undefined,
        customerMobilePhone: tossMobilePhone(form.customerPhone),
      });
    } catch (e) {
      // 결제창을 못 연 이유를 사용자에게 알림 (창 닫기 취소는 조용히 무시)
      console.error(e);
      const msg = payErrorMessage(e);
      if (msg) alert(msg);
      setLoading(false);
    }
  }

  const inputClass = "ds-input";
  const inputStyle = {};

  return (
    <div className="space-y-9">
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
                onFocus={(e) => (e.target.style.borderColor = "#244B1F")}
                onBlur={(e) => (e.target.style.borderColor = "#E4E1D6")}
              />
              {name === "customerPhone" && phoneVerifyRequired && (
                <PhoneVerifyField phone={form.customerPhone} verified={phoneVerified} onVerified={() => setPhoneVerified(true)} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 배송지 정보 */}
      <section className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>배송지 정보</h2>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
            <input type="checkbox" name="sameAsBuyer" checked={form.sameAsBuyer} onChange={handleChange} className="rounded" />
            구매자 정보와 동일
          </label>
        </div>
        <div className="space-y-3">
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
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
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
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>상세주소</label>
            <input name="shippingAddress2" value={form.shippingAddress2} onChange={handleChange} placeholder="101동 101호" className={inputClass} style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "var(--accent)")} onBlur={(e) => (e.target.style.borderColor = "var(--line)")} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>배송 메모</label>
            <textarea
              name="shippingMemo"
              value={form.shippingMemo}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingMemo: e.target.value }))}
              placeholder="배송 시 요청사항을 입력해주세요"
              rows={2}
              className={inputClass}
              style={{ ...inputStyle, resize: "none" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
            />
          </div>
        </div>
      </section>

      {/* 결제 금액 요약 */}
      <section className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--line)", boxShadow: "var(--card-shadow)" }}>
        <div className="space-y-2 text-sm mb-4 tnum" style={{ color: "var(--text-secondary)" }}>
          <div className="flex justify-between">
            <span>상품 금액</span>
            <span>{(unitPrice * quantity).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span>배송비</span>
            <span>{shippingCost === 0 ? "무료" : `${shippingCost.toLocaleString()}원`}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>총 결제 금액</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--accent)" }}>{totalAmount.toLocaleString()}원</span>
          </div>
        </div>
        <div className="mt-3.5">
          <PrivacyConsent checked={privacyAgreed} onChange={setPrivacyAgreed} />
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full text-white font-bold py-4 rounded-2xl transition-all hover:brightness-95 disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {loading ? "처리 중..." : `${totalAmount.toLocaleString()}원 결제하기`}
        </button>
      </section>
    </div>
  );
}
