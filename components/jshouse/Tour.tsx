"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPACES } from "@/components/jshouse/content";

// 공간 둘러보기.
//  · 넓은 화면: 왼쪽 사진 틀이 화면에 붙어 있고, 오른쪽 글이 지나갈 때마다 사진이 커튼처럼 바뀐다.
//  · 휴대폰: 옆으로 넘기는 카드 (현재 장수·진행 막대 표시).
//  · 사진을 누르면 크게 보기 — 좌우 넘기기, 아래로 쓸어 닫기, Esc.

const pad = (n: number) => String(n).padStart(2, "0");

function Lightbox({ index, onClose, onMove }: { index: number; onClose: () => void; onMove: (delta: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), touch = useRef<{ x: number; y: number } | null>(null);
  const space = SPACES[index];
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className="jsh-lightbox" aria-label="사진 크게 보기" onClose={onClose}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    onKeyDown={e => { if (e.key === "ArrowRight") onMove(1); if (e.key === "ArrowLeft") onMove(-1); }}
    onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
    onTouchEnd={e => {
      const from = touch.current; touch.current = null;
      if (!from) return;
      const dx = e.changedTouches[0].clientX - from.x, dy = e.changedTouches[0].clientY - from.y;
      if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose();
      else if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) onMove(dx < 0 ? 1 : -1);
    }}>
    <div className="jsh-lightbox-top">
      <span>{pad(index + 1)} <i>/ {pad(SPACES.length)}</i></span>
      <b>{space.label}</b>
      <button type="button" autoFocus onClick={onClose} aria-label="크게 보기 닫기">닫기 ×</button>
    </div>
    <figure key={space.key}><img src={space.photo.src} alt={space.alt} /></figure>
    <div className="jsh-lightbox-nav">
      <button type="button" onClick={() => onMove(-1)} aria-label="이전 사진">←</button>
      <p>{space.title}</p>
      <button type="button" onClick={() => onMove(1)} aria-label="다음 사진">→</button>
    </div>
  </dialog>;
}

export default function Tour() {
  const [active, setActive] = useState(0), [zoom, setZoom] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // 넓은 화면: 가운데 띠에 들어온 글이 현재 공간 / 휴대폰: 가로 스크롤 위치로 현재 카드
  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const steps = Array.from(root.children) as HTMLElement[];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && window.matchMedia("(min-width: 960px)").matches) setActive(steps.indexOf(entry.target as HTMLElement));
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(step => observer.observe(step));
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia("(min-width: 960px)").matches) return;
        const center = root.scrollLeft + root.clientWidth / 2;
        let best = 0, distance = Infinity;
        steps.forEach((step, i) => { const d = Math.abs(step.offsetLeft + step.offsetWidth / 2 - center); if (d < distance) { distance = d; best = i; } });
        setActive(best);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => { observer.disconnect(); root.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  const go = useCallback((index: number) => {
    const root = list.current, step = root?.children[index] as HTMLElement | undefined;
    if (!root || !step) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.matchMedia("(min-width: 960px)").matches) step.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    else root.scrollTo({ left: step.offsetLeft - (root.clientWidth - step.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const moveZoom = useCallback((delta: number) => setZoom(z => (z === null ? z : (z + delta + SPACES.length) % SPACES.length)), []);

  return <section className="jsh-section jsh-tour" id="space" aria-labelledby="jsh-tour-title">
    <div className="jsh-wrap">
      <div className="jsh-section-head">
        <p className="jsh-label" data-reveal="up">SPACE<span>공간</span></p>
        <h2 className="jsh-h2" id="jsh-tour-title" data-reveal="up">방에서 방으로,<br />천천히 둘러보기.</h2>
      </div>
      <div className="jsh-tour-grid">
        <div className="jsh-tour-stage" aria-hidden="true">
          <div className="jsh-tour-frame" data-cursor="크게 보기" onClick={() => setZoom(active)}>
            {SPACES.map((s, i) => <img key={s.key} src={s.photo.src} alt="" loading={i === 0 ? "eager" : "lazy"} data-on={i === active || undefined} data-before={i < active || undefined} />)}
            <span className="jsh-tour-count"><b key={active} className="jsh-flip">{pad(active + 1)}</b><i>/ {pad(SPACES.length)}</i></span>
            <span className="jsh-tour-tag" key={`t${active}`}>{SPACES[active].label}</span>
          </div>
          <div className="jsh-tour-bar"><i style={{ transform: `scaleY(${(active + 1) / SPACES.length})` }} /></div>
        </div>
        <ol className="jsh-tour-steps" ref={list}>
          {SPACES.map((s, i) => <li key={s.key} data-on={i === active || undefined}>
            <button type="button" className="jsh-tour-photo" onClick={() => setZoom(i)} aria-label={`${s.title} 사진 크게 보기`}>
              <img src={s.photo.src} alt={s.alt} loading="lazy" width={952} height={1269} />
              <span>{pad(i + 1)}</span>
            </button>
            <div className="jsh-tour-text">
              <p className="jsh-tour-no"><span>{pad(i + 1)}</span>{s.label}</p>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <ul>{s.points.map(point => <li key={point}>{point}</li>)}</ul>
            </div>
          </li>)}
        </ol>
      </div>
      <div className="jsh-tour-dots" role="tablist" aria-label="공간 선택">
        {SPACES.map((s, i) => <button key={s.key} type="button" role="tab" aria-selected={i === active} aria-label={`${pad(i + 1)} ${s.title}`} onClick={() => go(i)}><i /></button>)}
        <span>{pad(active + 1)} / {pad(SPACES.length)}</span>
      </div>
    </div>
    {zoom !== null && <Lightbox index={zoom} onClose={() => setZoom(null)} onMove={moveZoom} />}
  </section>;
}
