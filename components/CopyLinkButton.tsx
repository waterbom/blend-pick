"use client";

import { useState } from "react";

// 인플루언서 전용 공구 링크 복사 버튼 (/c/<campaignId>)
export default function CopyLinkButton({
  campaignId,
  className,
}: {
  campaignId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/c/${campaignId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드 API 미지원(비HTTPS 등) 폴백
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors " +
          (copied
            ? "bg-green-50 border-green-200 text-green-600"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")
      }
    >
      {copied ? "복사됨 ✓" : "링크 복사하기"}
    </button>
  );
}
