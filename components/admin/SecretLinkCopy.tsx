"use client";

import { useState } from "react";

// 상품 목록에서 비전시 링크 주소를 바로 복사하는 작은 버튼 (주소 자체는 노출하지 않고 복사만)
export default function SecretLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사에 실패했어요. 상품 수정 화면에서 링크를 직접 복사해주세요.");
    }
  }

  return (
    <button type="button" onClick={handleCopy} title="비전시 링크 복사"
      className="text-[10.5px] font-bold px-1.5 py-0.5 rounded transition-colors"
      style={{
        background: copied ? "#EAF0E6" : "rgba(0,0,0,.05)",
        color: copied ? "#244B1F" : "#3E423A",
        border: `1px solid ${copied ? "#C7D6C0" : "#D6D6CF"}`,
      }}>
      {copied ? "✓ 복사됨" : "링크 복사"}
    </button>
  );
}
