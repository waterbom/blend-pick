"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DOOR_SIZES, ROOMS, ROOM_KEYS, SPACES_BY_ROOM, srcSet, type RoomKey, type Space } from "@/components/limen/content";
import { RoomCta, useStay } from "@/components/limen/Booking";

// 05 — 공간 둘러보기. 객실(원룸·투룸)을 고르면 그 객실의 사진으로 바뀐다.
//  문 모양 사진 틀이 화면에 붙어 있고, 글이 지나갈 때마다 사진이 문이 열리듯 바뀐다 — 휴대폰과 넓은 화면이 같은 장면을 쓴다.
//  · 넓은 화면: 사진 틀은 왼쪽 가운데, 글은 오른쪽에서 지나간다.
//  · 휴대폰: 사진 틀은 화면 위쪽에 붙고, 글이 그 아래로 지나간다.
//  · 사진을 누르면 크게 보기 — 좌우 넘기기, 아래로 쓸어 닫기, Esc.
//  스크립트가 꺼져 있으면 글마다 자기 사진을 보여 준다 (limen.css 의 .lm:not([data-motion]) 규칙).

const pad = (n: number) => String(n).padStart(2, "0");
// 고정된 사진 틀의 너비: 휴대폰은 화면의 62% 이하, 넓은 화면은 30% 이하
const TOUR_SIZES = "(max-width: 959px) 62vw, 30vw";

function Lightbox({ spaces, index, onClose, onMove }: { spaces: Space[]; index: number; onClose: () => void; onMove: (delta: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), touch = useRef<{ x: number; y: number } | null>(null);
  const space = spaces[index];
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className="lm-lightbox" aria-label="사진 크게 보기" onClose={onClose}
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
    <div className="lm-lightbox-top">
      <span>{pad(index + 1)} <i>/ {pad(spaces.length)}</i></span>
      <b>{space.label}</b>
      <button type="button" autoFocus onClick={onClose} aria-label="크게 보기 닫기">닫기 ×</button>
    </div>
    <figure key={space.key}><img src={space.photo.src} alt={space.alt} /></figure>
    <div className="lm-lightbox-nav">
      <button type="button" onClick={() => onMove(-1)} aria-label="이전 사진">←</button>
      <p>{space.title}</p>
      <button type="button" onClick={() => onMove(1)} aria-label="다음 사진">→</button>
    </div>
  </dialog>;
}

export default function Tour() {
  const { config } = useStay();
  const [room, setRoom] = useState<RoomKey>("one"), [active, setActive] = useState(0), [zoom, setZoom] = useState<number | null>(null), [near, setNear] = useState(false);
  const list = useRef<HTMLOListElement>(null), section = useRef<HTMLElement>(null);
  const spaces = SPACES_BY_ROOM[room];
  const choose = (next: RoomKey) => { if (next !== room) { setRoom(next); setActive(0); setZoom(null); } };

  // 겹쳐 둔 사진은 가려져 있는 동안 지연 로딩이 시작되지 않는다 — 이 구간이 가까워지면 한꺼번에 받아 둔다
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: "900px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 지금 읽는 글이 현재 공간이다. 넓은 화면은 화면 가운데, 휴대폰은 고정된 사진 바로 아래의 띠에 들어온 글.
  // 객실을 바꾸면 새 목록으로 다시 건다.
  useEffect(() => {
    const root = list.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const steps = Array.from(root.children) as HTMLElement[];
    const narrow = window.matchMedia("(max-width: 959px)");
    let observer: IntersectionObserver | null = null;
    const watch = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) setActive(steps.indexOf(entry.target as HTMLElement));
      }, { rootMargin: narrow.matches ? "-62% 0px -37% 0px" : "-45% 0px -45% 0px" });
      steps.forEach(step => observer?.observe(step));
    };
    watch();
    narrow.addEventListener("change", watch);
    return () => { observer?.disconnect(); narrow.removeEventListener("change", watch); };
  }, [room]);

  const moveZoom = useCallback((delta: number) => setZoom(z => (z === null ? z : (z + delta + spaces.length) % spaces.length)), [spaces.length]);
  const current = spaces[Math.min(active, spaces.length - 1)];

  return <section ref={section} className="lm-section lm-tour" id="space" aria-labelledby="lm-tour-title">
    <div className="lm-wrap">
      <div className="lm-head lm-tour-head">
        <p className="lm-label" data-reveal><b>03</b><span>SPACE</span></p>
        <h2 className="lm-h2" id="lm-tour-title" data-reveal>문에서 문으로,<br />천천히 둘러보기</h2>
        <div className="lm-tour-pick" data-reveal>
          <div className="lm-tour-tabs" role="tablist" aria-label="둘러볼 객실">
            {ROOM_KEYS.map(key => <button key={key} type="button" role="tab" aria-selected={room === key} onClick={() => choose(key)}>
              {ROOMS[key].name}<small>{config.rooms[key].guests}인 · 사진 {SPACES_BY_ROOM[key].length}장</small>
            </button>)}
          </div>
          <RoomCta room={room} />
        </div>
      </div>
      <div className="lm-tour-grid" key={room}>
        <div className="lm-tour-stage" aria-hidden="true">
          <div className="lm-door lm-tour-frame" data-cursor="크게 보기" onClick={() => setZoom(active)}>
            {spaces.map((s, i) => <img key={s.key} src={s.photo.src} srcSet={srcSet(s.photo)} sizes={TOUR_SIZES} alt="" loading={near ? "eager" : "lazy"} decoding="async" data-on={i === active || undefined} data-before={i < active || undefined} />)}
            <span className="lm-tour-zoom" aria-hidden="true">＋</span>
          </div>
          <p className="lm-tour-count"><b key={active} className="lm-flip">{pad(active + 1)}</b><i>/ {pad(spaces.length)}</i><span key={`t${active}`} className="lm-flip">{ROOMS[room].name} · {current.label}</span></p>
        </div>
        <ol className="lm-tour-steps" ref={list}>
          {spaces.map((s, i) => <li key={s.key} data-on={i === active || undefined}>
            <button type="button" className="lm-tour-photo" onClick={() => setZoom(i)} aria-label={`${s.title} 사진 크게 보기`}>
              <img src={s.photo.src} srcSet={srcSet(s.photo)} sizes={DOOR_SIZES} alt={s.alt} loading="lazy" decoding="async" width={952} height={1269} />
            </button>
            <div className="lm-tour-text">
              <p className="lm-tour-no"><span>{pad(i + 1)}</span>{s.label}</p>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <ul>{s.points.map(point => <li key={point}>{point}</li>)}</ul>
            </div>
          </li>)}
        </ol>
      </div>
    </div>
    {zoom !== null && <Lightbox spaces={spaces} index={zoom} onClose={() => setZoom(null)} onMove={moveZoom} />}
  </section>;
}
