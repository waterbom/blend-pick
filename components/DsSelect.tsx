"use client";
import { useEffect, useRef, useState } from "react";

export interface DsOption { value: string; label: string; hint?: string; disabled?: boolean }

/**
 * 공용 드롭다운 — 브라우저 기본 <select> 대체 (딥 포레스트 톤, radius 0).
 * 닫힐 때도 애니메이션이 보이도록 언마운트 대신 opacity/max-height로 접는다.
 * 커스텀 버튼 기반이라 iOS 백버튼 폼 복원(웹킷) 문제도 원천적으로 없음.
 */
export default function DsSelect({
  value, options, placeholder = "선택하세요", onChange, height = 48,
}: { value?: string; options: DsOption[]; placeholder?: string; onChange: (v: string) => void; height?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "0 16px", background: "#fff", border: "1px solid #E4E1D6", cursor: "pointer",
          fontSize: 13.5, color: current ? "#1C2418" : "#8B927F", transition: "border-color .25s ease" }}>
        <span>{current?.label ?? placeholder}</span>
        <span style={{ fontSize: 11, color: "#7A8B6F", transition: "transform .3s cubic-bezier(.16,1,.3,1)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 20, overflow: "hidden",
        background: "#fff", border: "1px solid #E4E1D6", boxShadow: "0 12px 28px rgba(28,36,24,.12)",
        transition: "opacity .26s ease, transform .26s cubic-bezier(.16,1,.3,1), max-height .3s cubic-bezier(.16,1,.3,1)",
        opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : -6}px)`,
        pointerEvents: open ? "auto" : "none", maxHeight: open ? 260 : 0, overflowY: "auto" }}>
        {options.map((o) => (
          <button key={o.value} type="button" disabled={o.disabled}
            onClick={() => { onChange(o.value); setOpen(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "13px 16px", background: "#fff", border: "none", borderBottom: "1px solid #F0EDE4",
              textAlign: "left", fontSize: 13.5, cursor: o.disabled ? "default" : "pointer",
              color: o.disabled ? "#B4B0A2" : "#1C2418", transition: "background-color .2s ease" }}>
            <span>{o.label}</span>
            {o.hint && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5,
              color: o.disabled ? "#B4B0A2" : "#4A5442" }}>{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
