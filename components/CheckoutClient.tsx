"use client";

import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

interface Props {
  productId: string;
  productName: string;
  unitPrice: number;
  shippingCost: number;
  clientKey: string;
}

export default function CheckoutClient({
  productId,
  productName,
  unitPrice,
  shippingCost,
  clientKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const totalAmount = unitPrice + shippingCost;

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
    if (!form.customerName || !form.customerPhone) {
      alert("구매자 이름과 연락처를 입력해주세요.");
      return;
    }
    if (!form.shippingAddress || !form.shippingZipcode) {
      alert("배송지를 입력해주세요.");
      return;
    }

    setLoading(true);

    const checkoutData = {
      productId,
      productName,
      unitPrice,
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
        orderName: productName,
        successUrl: `${window.location.origin}/checkout/success`,
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

  return (
    <div className="space-y-4">
      {/* 구매자 정보 */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">구매자 정보</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">이름 *</label>
            <input
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              placeholder="홍길동"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">연락처 *</label>
            <input
              name="customerPhone"
              value={form.customerPhone}
              onChange={handleChange}
              placeholder="010-0000-0000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">이메일 (선택)</label>
            <input
              name="customerEmail"
              value={form.customerEmail}
              onChange={handleChange}
              placeholder="example@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>
      </section>

      {/* 배송지 정보 */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">배송지 정보</h2>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              name="sameAsBuyer"
              checked={form.sameAsBuyer}
              onChange={handleChange}
              className="rounded"
            />
            구매자 정보와 동일
          </label>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">받는 분 *</label>
              <input
                name="shippingName"
                value={form.shippingName}
                onChange={handleChange}
                placeholder="홍길동"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">연락처 *</label>
              <input
                name="shippingPhone"
                value={form.shippingPhone}
                onChange={handleChange}
                placeholder="010-0000-0000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">우편번호 *</label>
            <input
              name="shippingZipcode"
              value={form.shippingZipcode}
              onChange={handleChange}
              placeholder="12345"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">주소 *</label>
            <input
              name="shippingAddress"
              value={form.shippingAddress}
              onChange={handleChange}
              placeholder="서울시 강남구 테헤란로 123"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">상세주소</label>
            <input
              name="shippingAddress2"
              value={form.shippingAddress2}
              onChange={handleChange}
              placeholder="101동 101호"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">배송 메모</label>
            <select
              name="shippingMemo"
              value={form.shippingMemo}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white"
            >
              <option value="">선택 안함</option>
              <option value="문 앞에 놔주세요">문 앞에 놔주세요</option>
              <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
              <option value="배송 전 연락 부탁드려요">배송 전 연락 부탁드려요</option>
            </select>
          </div>
        </div>
      </section>

      {/* 결제 금액 요약 + 버튼 */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex justify-between">
            <span>상품 금액</span>
            <span>{unitPrice.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span>배송비</span>
            <span>{shippingCost === 0 ? "무료" : `${shippingCost.toLocaleString()}원`}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-2">
            <span>총 결제 금액</span>
            <span>{totalAmount.toLocaleString()}원</span>
          </div>
        </div>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-gray-900 text-white font-semibold py-4 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "처리 중..." : `${totalAmount.toLocaleString()}원 결제하기`}
        </button>
      </section>
    </div>
  );
}
