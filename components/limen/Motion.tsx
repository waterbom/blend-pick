"use client";

import { useEffect, useRef } from "react";

// LIMEN 페이지의 움직임을 한곳에서 붙인다 (화면에 그리는 것은 커서 하나뿐). 휴대폰과 넓은 화면이 같은 효과를 쓴다.
//  · 등장(reveal): 화면에 들어오면 한 번 — 글은 떠오르고, 사진은 문이 열리듯 드러난다
//  · 장면(scene): 고정된 구간을 지나는 만큼 --p(0→1)를 넘겨 '문이 열리는' 장면을 스크롤에 맞춘다
//  · 스크롤 진행 막대 · 헤더 숨김/표시 · 패럴랙스 · 단어 채우기
//  · 마우스 환경: 사진 위에서 따라다니는 커서 / 터치 환경: 화면 가운데에 온 줄을 강조 (마우스를 올렸을 때와 같은 표시)
// 성능 — 휴대폰에서 스크롤이 끊기지 않도록 지키는 규칙:
//  · 한 프레임에 한 번만 계산하고, 위치를 모두 읽은 뒤에 한꺼번에 쓴다 (읽기와 쓰기를 섞으면 스타일 계산이 프레임마다 반복된다)
//  · 값은 그 값을 쓰는 요소에만, 바뀌었을 때만 쓴다. 페이지 전체에 물려주는 값을 프레임마다 바꾸지 않는다.
//  · 화면 근처에 있는 요소만 계산한다.
// transform · opacity · clip-path 만 움직인다. '동작 줄이기' 설정이면 등장 효과는 즉시 보이게 하고 나머지 움직임은 붙이지 않는다.
export default function Motion() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lm");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: (() => void)[] = [];
    const all = <T extends HTMLElement = HTMLElement>(selector: string) => Array.from(root.querySelectorAll<T>(selector));
    root.dataset.motion = reduced ? "reduced" : "on";

    // 등장 — 화면에 들어오면 한 번만
    const revealables = all("[data-reveal]");
    if (reduced || !("IntersectionObserver" in window)) revealables.forEach(el => el.classList.add("is-in"));
    else {
      const io = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });
      revealables.forEach(el => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    // 스크롤에 묶인 것들
    const header = root.querySelector<HTMLElement>("[data-lm-header]");
    const bar = root.querySelector<HTMLElement>(".lm-progress");
    const parallax = reduced ? [] : all("[data-parallax]");
    const scenes = all("[data-scene]");
    const words = all("[data-words]");
    if (reduced) {
      words.forEach(p => Array.from(p.children).forEach(w => w.classList.add("on")));
      scenes.forEach(el => el.style.setProperty("--p", "1"));
    }
    // 화면 근처에 있는 것만 계산한다
    const tracked = reduced ? [] : [...scenes, ...parallax, ...words];
    const live = new Set<HTMLElement>(tracked);
    if (tracked.length && "IntersectionObserver" in window) {
      live.clear();
      const near = new IntersectionObserver(entries => {
        for (const entry of entries) { if (entry.isIntersecting) live.add(entry.target as HTMLElement); else live.delete(entry.target as HTMLElement); }
        schedule();
      }, { rootMargin: "25% 0px 25% 0px" });
      tracked.forEach(el => near.observe(el));
      cleanups.push(() => near.disconnect());
    }
    const sent = new Map<HTMLElement, string | number>(); // 요소마다 마지막으로 쓴 값
    const put = (el: HTMLElement, name: string, value: string) => { if (sent.get(el) !== value) { sent.set(el, value); el.style.setProperty(name, value); } };
    let last = window.scrollY, frame = 0, solid = "", hidden = "", progress = "";
    const update = () => {
      frame = 0;
      // ── 읽기
      const y = window.scrollY, vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
      const rects = new Map<HTMLElement, DOMRect>();
      for (const el of live) rects.set(el, el.getBoundingClientRect());
      // ── 쓰기
      const done = (max > 0 ? Math.min(1, y / max) : 0).toFixed(4);
      if (bar && done !== progress) { progress = done; bar.style.transform = `scaleX(${done})`; }
      if (header) {
        const nextSolid = y > 24 ? "1" : "";
        // 내려갈 때 숨기고, 올라오면 다시 보인다
        const nextHidden = y > vh * 0.6 && y > last + 4 ? "1" : y < last - 4 || y < vh * 0.6 ? "" : hidden;
        if (nextSolid !== solid) header.dataset.solid = solid = nextSolid;
        if (nextHidden !== hidden) header.dataset.hidden = hidden = nextHidden;
      }
      last = y;
      for (const el of scenes) {
        const rect = rects.get(el);
        if (!rect) continue;
        const span = rect.height - vh;
        put(el, "--p", (span > 0 ? Math.max(0, Math.min(1, -rect.top / span)) : 1).toFixed(3));
      }
      for (const el of parallax) {
        const rect = rects.get(el);
        if (rect) put(el, "--lm-shift", `${((rect.top + rect.height / 2 - vh / 2) * Number(el.dataset.parallax)).toFixed(1)}px`);
      }
      for (const p of words) {
        const rect = rects.get(p);
        if (!rect) continue;
        const on = Math.round(Math.max(0, Math.min(1, (vh * 0.88 - rect.top) / (vh * 0.52 + rect.height))) * p.children.length);
        const before = (sent.get(p) as number | undefined) ?? 0;
        if (on === before) continue;
        // 바뀐 단어만 건드린다
        for (let i = Math.min(on, before); i < Math.max(on, before); i++) p.children[i].classList.toggle("on", i < on);
        sent.set(p, on);
      }
    };
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    cleanups.push(() => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); });

    // 터치 환경: 화면 가운데를 지나는 줄을 강조한다 — 마우스를 올렸을 때와 같은 표시를 스크롤로 준다
    const focusables = all("[data-focus]");
    if (!fine && !reduced && focusables.length && "IntersectionObserver" in window) {
      const focus = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) { focusables.forEach(el => { if (el !== entry.target) delete el.dataset.focused; }); (entry.target as HTMLElement).dataset.focused = "1"; }
          else delete (entry.target as HTMLElement).dataset.focused;
        }
      }, { rootMargin: "-46% 0px -46% 0px" });
      focusables.forEach(el => focus.observe(el));
      cleanups.push(() => { focus.disconnect(); focusables.forEach(el => delete el.dataset.focused); });
    }

    // 마우스 환경에서만: 사진 위에서 '크게 보기'를 알려 주는 커서
    if (fine && !reduced) {
      const dot = cursor.current;
      let x = 0, y = 0, tx = 0, ty = 0, raf = 0, visible = false;
      const follow = () => {
        x += (tx - x) * 0.2; y += (ty - y) * 0.2;
        if (dot) dot.style.transform = `translate3d(${x}px,${y}px,0)`;
        raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(follow) : 0;
      };
      const onMove = (e: PointerEvent) => {
        tx = e.clientX; ty = e.clientY;
        if (!visible) { visible = true; x = tx; y = ty; }
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor]");
        if (dot) { dot.dataset.on = target ? "1" : ""; if (target) dot.dataset.label = target.dataset.cursor || ""; }
        if (!raf) raf = requestAnimationFrame(follow);
      };
      const onLeave = () => { if (dot) dot.dataset.on = ""; };
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
      cleanups.push(() => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", onLeave); cancelAnimationFrame(raf); });
    }

    // 이용 안내 아코디언 — 하나를 열면 나머지는 닫는다
    const faqs = all<HTMLDetailsElement>(".lm-faq details");
    const onToggle = (e: Event) => { const opened = e.target as HTMLDetailsElement; if (opened.open) faqs.forEach(d => { if (d !== opened) d.open = false; }); };
    faqs.forEach(d => d.addEventListener("toggle", onToggle));
    cleanups.push(() => faqs.forEach(d => d.removeEventListener("toggle", onToggle)));

    return () => { cleanups.forEach(fn => fn()); delete root.dataset.motion; };
  }, []);
  return <div ref={cursor} className="lm-cursor" aria-hidden="true" />;
}
