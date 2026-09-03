"use client";

import { useEffect, useRef } from "react";

// 산지픽 랜딩 ② "산지픽은 이렇게 달라요" (시안 herospec ② 기준)
// 히어로 폰 목업이 위로 200px 걸쳐 내려오므로 padding-top 290px, 딥그린→아이보리 세로 그라데이션.
// 에셋 (public/sanji/): why-farmer.png / why-storage.png / why-produce.png (120×120 크롭 표시), cert-*.png, badge-*.png

const CARDS = [
  { no: "01", img: "/sanji/why-farmer.png", pos: "60% 40%", title: "농가 직거래", desc: "산지 농부와 직접 계약, 유통 마진 0" },
  { no: "02", img: "/sanji/why-storage.png", pos: "50% 50%", title: "수확 당일 발송", desc: "아침에 따서 저녁에 포장, 다음 날 집 앞" },
  { no: "03", img: "/sanji/why-produce.png", pos: "35% 50%", title: "직접 먹어보고 검증", desc: "인플루언서가 먹어보고 통과한 것만 공구" },
];

// 하단 인증 서류 블록 (certsblock.html) — 서류 이미지가 없으면 자리만 잡히고, 올리면 바로 표시
// 에셋: cert-lowcarbon.png (썸네일) / cert-lowcarbon-field.png (크게 보기) / cert-6th.png, badge-gap.png / badge-6th.png
const CERTS = [
  { doc: "/sanji/cert-lowcarbon.png", full: "/sanji/cert-lowcarbon-field.png", pos: "top", badge: "/sanji/badge-gap.png", short: "GAP", name: "GAP·저탄소 인증", org: "안전관리 기준 통과 농산물", alt: "저탄소 농축산물 인증서" },
  { doc: "/sanji/cert-6th.png", full: "/sanji/cert-6th.png", pos: "left top", badge: "/sanji/badge-6th.png", short: "6차", name: "6차산업 인증", org: "농림축산식품부", alt: "농촌융복합산업 사업자 인증서" },
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
        .sj-why{position:relative;z-index:1;overflow:hidden;max-width:390px;margin:0 auto;padding:290px 24px 64px;display:flex;flex-direction:column;gap:28px;color:#1a1a17;font-family:'Noto Sans KR',sans-serif;background:linear-gradient(180deg,#0b150e 0px,#1c2a1c 90px,#8f8a72 190px,#fbf7ee 270px,#fbf7ee 100%)}
        .sj-why__glow{position:absolute;left:50%;top:40px;width:340px;height:340px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,138,80,.55) 0%,rgba(255,138,80,.18) 40%,rgba(255,138,80,0) 70%);filter:blur(18px);pointer-events:none}
        .sj-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .sj-reveal.is-in{opacity:1;transform:none}
        .sj-why__head{display:flex;flex-direction:column;gap:10px}
        .sj-why__label{font-size:12px;font-weight:700;color:#ff6a3d;letter-spacing:.08em}
        .sj-why__title{font-size:28px;line-height:1.25;font-weight:900;letter-spacing:-.03em;word-break:keep-all;margin:0}
        .sj-why__sub{font-size:14px;line-height:1.6;color:#6b675e;word-break:keep-all;margin:0}
        .sj-why__list{display:flex;flex-direction:column;gap:14px}
        .sj-wcard{display:grid;grid-template-columns:120px 1fr;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(60,40,10,.08)}
        .sj-wcard__img{width:120px;height:120px;background-color:#e9e3d3;background-size:cover;background-repeat:no-repeat}
        .sj-wcard__body{padding:16px 16px 16px 18px;display:flex;flex-direction:column;justify-content:center;gap:6px}
        .sj-wcard__num{font-size:11px;font-weight:700;color:#ff6a3d}
        .sj-wcard__title{font-size:17px;font-weight:900;letter-spacing:-.02em}
        .sj-wcard__desc{font-size:13px;line-height:1.5;color:#6b675e;word-break:keep-all;text-wrap:pretty}
        .sj-certs{display:flex;flex-direction:column;gap:14px}
        .sj-certs__head{display:flex;justify-content:space-between;align-items:baseline}
        .sj-certs__title{font-size:15px;font-weight:900;letter-spacing:-.02em}
        .sj-certs__hint{font-size:11px;color:#9a9484;white-space:nowrap}
        .sj-certs__grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .sj-cert{display:flex;flex-direction:column;gap:10px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 6px 24px rgba(60,40,10,.08);text-decoration:none;color:#1a1a17}
        .sj-cert__doc{height:150px;border-radius:10px;overflow:hidden;background:#eef0e6;background-size:cover;background-repeat:no-repeat;display:flex;align-items:center;justify-content:center;font-size:11px;color:#9a9484}
        .sj-cert__meta{display:flex;align-items:center;gap:8px}
        .sj-cert__badge{width:26px;height:26px;border-radius:50%;flex-shrink:0;background-color:#e9e3d3;background-size:cover;background-position:center;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#6b675e}
        .sj-cert__meta div{display:flex;flex-direction:column;min-width:0;gap:2px}
        .sj-cert__name{font-size:12px;font-weight:700;line-height:1.3;word-break:keep-all}
        .sj-cert__org{font-size:10px;color:#6b675e}
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

      {/* 인증 서류 — 탭하면 원본 이미지를 새 탭으로 */}
      <div className="sj-certs sj-reveal">
        <div className="sj-certs__head">
          <div className="sj-certs__title">국가 인증 서류, 직접 확인하세요</div>
          <div className="sj-certs__hint">탭하면 크게 보기</div>
        </div>
        <div className="sj-certs__grid">
          {CERTS.map((c) => (
            <a key={c.name} className="sj-cert" href={c.full} target="_blank" rel="noreferrer">
              <div className="sj-cert__doc" role="img" aria-label={c.alt} style={{ backgroundImage: `url(${c.doc})`, backgroundPosition: c.pos }} />
              <div className="sj-cert__meta">
                <span className="sj-cert__badge" role="img" aria-label={c.name} style={{ backgroundImage: `url(${c.badge})` }}>{c.short}</span>
                <div><span className="sj-cert__name">{c.name}</span><span className="sj-cert__org">{c.org}</span></div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
