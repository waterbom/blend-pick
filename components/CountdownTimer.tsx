"use client";

import { useEffect, useState } from "react";

/**
 * 남은 시간 계산 함수
 * target(ISO 날짜 문자열)까지 남은 일/시/분/초를 반환
 * 이미 지났으면 null → "종료됨" 표시
 */
function calcRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);       // 1일 = 86,400,000ms
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

/**
 * CountdownTimer
 *
 * 디자인 변경:
 * 기존: border border-gray-200 rounded px-2 py-1 → 엑셀 셀 느낌
 * 변경: 따뜻한 배경색 pill + 얇은 폰트 → cozy하고 깔끔
 *
 * suppressHydrationWarning:
 * - 서버에서 렌더링한 시간과 클라이언트 시간이 다를 수 있어서
 * - React가 경고를 뿜는데, 시계 같은 건 당연히 다르니까 무시해도 됨
 */
export default function CountdownTimer({
  target,
  label,
  dark = false,
}: {
  target: string;
  label: string;
  dark?: boolean;
}) {
  const [remaining, setRemaining] = useState(calcRemaining(target));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(calcRemaining(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!remaining) {
    return (
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        종료됨
      </span>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="inline-flex items-center gap-1.5 text-sm font-mono whitespace-nowrap"
      style={{ color: dark ? "#c4765b" : "var(--accent)" }}
    >
      <span className="font-medium mr-0.5" style={{ color: dark ? "#6b6560" : "var(--text-muted)" }}>{label}</span>
      <span className="font-bold" suppressHydrationWarning>{remaining.d}일</span>
      <span style={{ opacity: 0.5 }}>:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.h)}</span>
      <span style={{ opacity: 0.5 }}>:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.m)}</span>
      <span style={{ opacity: 0.5 }}>:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.s)}</span>
    </div>
  );
}
