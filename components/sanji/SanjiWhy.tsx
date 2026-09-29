"use client";

import { useEffect, useRef } from "react";

// 산지픽 랜딩 ② "산지픽은 이렇게 달라요" (시안 herospec ② 기준)
// 히어로 폰 목업이 위로 200px 걸쳐 내려오므로 padding-top 290px, 딥그린→아이보리 세로 그라데이션.
// 에셋 (public/sanji/): why-farmer.png / why-storage.png / why-produce.png (120×120 크롭 표시)

const CARDS = [
  { no: "01", img: "/sanji/why-farmer.png", pos: "60% 40%", title: "농가 직거래", desc: "산지 농부와 직접 계약, 유통 마진 0" },
  { no: "02", img: "/sanji/why-storage.png", pos: "50% 50%", title: "수확 당일 발송", desc: "아침에 따서 저녁에 포장, 다음 날 집 앞" },
  { no: "03", img: "/sanji/why-produce.png", pos: "35% 50%", title: "직접 먹어보고 검증", desc: "인플루언서가 먹어보고 통과한 것만 공구" },
];

export default function SanjiWhy() {
  const root = useRef<HTMLElement>(null);

  // 스크롤 리빌 — 화면에 20% 들어오면 순서대로 0.12s 시차를 두고 떠오름
  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>(".sj-reveal") ?? []);
    if (els.length === 0) return;
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${els.indexOf(el) * 0.12}s`;
        el.classList.add("is-in");
        io.unobserve(el);
      }
    }, { threshold: 0.2 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section ref={root} className="sj-why">
      <style>{`
        .sj-why{position:relative;z-index:1;overflow:hidden;max-width:390px;margin:0 auto;padding:290px 24px 64px;display:flex;flex-direction:column;gap:28px;color:#191919;font-family:inherit;background:linear-gradient(180deg,#191919 0px,#2a2a2a 90px,#9a9a9a 190px,#F7F7F7 270px,#F7F7F7 100%)}
        .sj-why__glow{position:absolute;left:50%;top:40px;width:340px;height:340px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,138,80,.55) 0%,rgba(255,138,80,.18) 40%,rgba(255,138,80,0) 70%);filter:blur(18px);pointer-events:none}
        .sj-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .sj-reveal.is-in{opacity:1;transform:none}
        .sj-why__head{display:flex;flex-direction:column;gap:10px}
        .sj-why__label{font-size:12px;font-weight:700;color:#C9430E;letter-spacing:.08em}
        .sj-why__title{font-size:28px;line-height:1.3;font-weight:700;letter-spacing:-.03em;word-break:keep-all;margin:0}
        .sj-why__sub{font-size:14px;line-height:1.6;color:#6E6E6E;word-break:keep-all;margin:0}
        .sj-why__list{display:flex;flex-direction:column;gap:14px}
        .sj-wcard{display:grid;grid-template-columns:120px 1fr;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.05)}
        .sj-wcard__img{width:120px;height:120px;background-color:#EDEDED;background-size:cover;background-repeat:no-repeat}
        .sj-wcard__body{padding:16px 16px 16px 18px;display:flex;flex-direction:column;justify-content:center;gap:6px}
        .sj-wcard__num{font-size:12px;font-weight:700;color:#C9430E}
        .sj-wcard__title{font-size:17px;font-weight:700;letter-spacing:-.02em}
        .sj-wcard__desc{font-size:13px;line-height:1.5;color:#6E6E6E;word-break:keep-all;text-wrap:pretty}
        @media (prefers-reduced-motion: reduce){.sj-reveal{opacity:1;transform:none;transition:none}}
      `}</style>

      <div className="sj-why__glow" aria-hidden />

      <div className="sj-why__head sj-reveal">
        <div className="sj-why__label">WHY 산지픽</div>
        <h2 className="sj-why__title">산지픽은<br />이렇게 달라요</h2>
        <p className="sj-why__sub">중간 유통 없이 농부가 딴 그대로, 우리가 먼저 먹어보고 보냅니다.</p>
      </div>

      <div className="sj-why__list">
        {CARDS.map((c) => (
          <div key={c.no} className="sj-wcard sj-reveal">
            <div className="sj-wcard__img" role="img" aria-label={c.title} style={{ backgroundImage: `url(${c.img})`, backgroundPosition: c.pos }} />
            <div className="sj-wcard__body">
              <div className="sj-wcard__num">{c.no}</div>
              <div className="sj-wcard__title">{c.title}</div>
              <div className="sj-wcard__desc">{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
