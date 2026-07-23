"use client";

import { useState } from "react";

/**
 * 결제 전 개인정보 수집·이용 동의 (필수) — 개인정보보호위원회 표준 고지 4항목
 * (수집 항목 · 목적 · 보유기간 · 거부권과 불이익) 형식을 따른 문구.
 */
export default function PrivacyConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-card px-5 py-4">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#2D5A27]"
        />
        <span className="text-[13px] leading-relaxed" style={{ color: "#1C2418" }}>
          <b>[필수]</b> 개인정보 수집·이용에 동의합니다.{" "}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setOpen(!open); }}
            className="text-xs font-semibold underline"
            style={{ color: "#2D5A27" }}
          >
            {open ? "내용 접기" : "내용 보기"}
          </button>
        </span>
      </label>
      {open && (
        <div
          className="mt-3 pt-3 text-xs leading-relaxed space-y-1.5"
          style={{ borderTop: "1px solid #E4E1D6", color: "#6B7263" }}
        >
          <p><b style={{ color: "#4A5442" }}>수집 항목</b> — 이름, 휴대폰 번호, 이메일(선택), 배송지 주소</p>
          <p><b style={{ color: "#4A5442" }}>수집·이용 목적</b> — 주문·결제 처리, 상품 배송, 취소·환불, 고객 문의 응대</p>
          <p><b style={{ color: "#4A5442" }}>보유·이용 기간</b> — 전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약·청약철회, 대금결제 및 재화 공급 기록 5년 보관 후 파기</p>
          <p>※ 동의를 거부할 권리가 있으며, 거부 시 상품 주문이 제한됩니다.</p>
        </div>
      )}
    </div>
  );
}
