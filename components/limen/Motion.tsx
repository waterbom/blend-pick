"use client";

import { useEffect, useRef } from "react";

// LIMEN 페이지의 움직임을 한곳에서 붙인다 (화면에 그리는 것은 커서 하나뿐).
//  · 등장(reveal): 화면에 들어오면 한 번 — 글은 떠오르고, 사진은 문이 열리듯 드러난다
//  · 장면(scene): 고정된 구간을 지나는 만큼 --p(0→1)를 넘겨 '문이 열리는' 장면을 스크롤에 맞춘다
//  · 스크롤 진행 막대 · 헤더 숨김/표시 · 패럴랙스 · 단어 채우기 · 마우스 환경의 따라다니는 커서
// transform·opacity·clip-path 만 움직이고, 한 프레임에 한 번만 계산한다.
// '동작 줄이기' 설정이면 등장 효과는 즉시 보이게 하고 나머지 움직임은 붙이지 않는다.
export default function Motion() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lm");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: (() => void)[] = [];
    root.dataset.motion = reduced ? "reduced" : "on";

    // 등장 — 화면에 들어오면 한 번만
    const revealables = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduced || !("IntersectionObserver" in window)) revealables.forEach(el => el.classList.add("is-in"));
    else {
      const io = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.06 });
      revealables.forEach(el => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    // 스크롤에 묶인 것들 — 한 프레임에 한 번만 계산
    const header = root.querySelector<HTMLElement>("[data-lm-header]");
    const parallax = reduced ? [] : Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-scene]"));
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-words]"));
    if (reduced) {
      words.forEach(p => Array.from(p.children).forEach(w => w.classList.add("on")));
      scenes.forEach(el => el.style.setProperty("--p", "1"));
    }
    let last = window.scrollY, frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY, vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
      root.style.setProperty("--lm-progress", String(max > 0 ? Math.min(1, y / max) : 0));
      if (header) {
        header.dataset.solid = y > 24 ? "1" : "";
        // 내려갈 때 숨기고, 올라오면 다시 보인다
        if (y > vh * 0.6 && y > last + 4) header.dataset.hidden = "1";
        else if (y < last - 4 || y < vh * 0.6) header.dataset.hidden = "";
      }
      last = y;
      if (reduced) return;
      for (const el of scenes) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -vh || rect.top > vh * 2) continue;
        const span = rect.height - vh;
        el.style.setProperty("--p", (span > 0 ? Math.max(0, Math.min(1, -rect.top / span)) : 1).toFixed(4));
      }
      for (const el of parallax) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue;
        el.style.setProperty("--lm-shift", `${((rect.top + rect.height / 2 - vh / 2) * Number(el.dataset.parallax)).toFixed(1)}px`);
      }
      for (const p of words) {
        const rect = p.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) continue;
        const progress = Math.max(0, Math.min(1, (vh * 0.88 - rect.top) / (vh * 0.52 + rect.height)));
        const on = Math.round(progress * p.children.length);
        Array.from(p.children).forEach((w, i) => w.classList.toggle("on", i < on));
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    cleanups.push(() => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(frame); });

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
    const faqs = Array.from(root.querySelectorAll<HTMLDetailsElement>(".lm-faq details"));
    const onToggle = (e: Event) => { const opened = e.target as HTMLDetailsElement; if (opened.open) faqs.forEach(d => { if (d !== opened) d.open = false; }); };
    faqs.forEach(d => d.addEventListener("toggle", onToggle));
    cleanups.push(() => faqs.forEach(d => d.removeEventListener("toggle", onToggle)));

    return () => { cleanups.forEach(fn => fn()); delete root.dataset.motion; };
  }, []);
  return <div ref={cursor} className="lm-cursor" aria-hidden="true" />;
}
