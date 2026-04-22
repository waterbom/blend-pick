"use client";

import { useEffect, useState } from "react";

function calcRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

export default function CountdownTimer({
  target,
  label,
}: {
  target: string;
  label: string;
}) {
  const [remaining, setRemaining] = useState(calcRemaining(target));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(calcRemaining(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!remaining) return <span className="text-xs text-gray-400">종료됨</span>;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono">
      <span className="mr-1">{label}</span>
      <span className="font-bold" suppressHydrationWarning>{remaining.d}일</span>
      <span className="text-gray-400 mx-0.5">:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.h)}</span>
      <span className="text-gray-400 mx-0.5">:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.m)}</span>
      <span className="text-gray-400 mx-0.5">:</span>
      <span className="font-bold" suppressHydrationWarning>{pad(remaining.s)}</span>
    </div>
  );
}
