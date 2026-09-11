"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Controls sit outside the images so product artwork stays fully visible. */
export default function ScrollRail({ children, label }: { children: ReactNode; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  useEffect(() => {
    const track = root.current?.firstElementChild as HTMLElement | null;
    if (!track) return;
    const update = () => setEdge({ start: track.scrollLeft <= 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    const resize = new ResizeObserver(update);
    resize.observe(track);
    Array.from(track.children).forEach(child => resize.observe(child));
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("load", update, true);
    update();
    return () => { resize.disconnect(); track.removeEventListener("scroll", update); track.removeEventListener("load", update, true); };
  }, [children]);
  function move(direction: number) {
    const track = root.current?.firstElementChild as HTMLElement | null;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const second = first?.nextElementSibling as HTMLElement | null;
    const step = first && second ? second.getBoundingClientRect().left - first.getBoundingClientRect().left : track.clientWidth;
    track.dataset.manualUntil = String(Date.now() + 6000);
    track.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div ref={root}>
    {children}
    {!(edge.start && edge.end) && <div role="group" aria-label={`${label} 넘기기`} className="flex items-center justify-end gap-2 py-2">
      <span className="text-xs mr-1" style={{ color: "var(--text-secondary, #555)" }}>옆으로 넘겨보기</span>
      {([-1, 1] as const).map(direction => <button key={direction} type="button" onClick={() => move(direction)} disabled={direction < 0 ? edge.start : edge.end}
        aria-label={`${label} ${direction < 0 ? "이전" : "다음"}`} className="inline-flex items-center justify-center w-11 h-11 rounded-full border disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--surface, #fff)", color: "var(--text-primary, #243324)", borderColor: "var(--line, #d5d9d0)" }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={direction < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}/></svg>
      </button>)}
    </div>}
  </div>;
}
