"use client";

import { useEffect, useRef } from "react";

// 산지픽 이야기 ③ OUR FARM + ④ PACKING (시안 herospec ③·④ 기준) — ② 아래에 이어 붙는다.
// 에셋 (public/sanji/): farm-harvester / farm-machine / farm-peach / farm-hands, pack-potato / pack-aircap (.png)
// 파일이 없으면 베이지 바탕만 보이고, 올리면 바로 반영된다. GIF/MP4로 바꾸려면 아래 CUTS의 video 필드에 경로를 넣으면 된다.

const ACCENT = "#ff6a3d";

const CUTS: { key: string; step: string; title: string; img: string; video?: string; half?: boolean }[] = [
  { key: "harvester", step: "01 수확", title: "기계 수확으로 하루 만에 밭 한 판", img: "/sanji/farm-harvester.png" },
  { key: "machine", step: "02 선별", title: "흙만 털고 바로 선별", img: "/sanji/farm-machine.png", half: true },
  { key: "peach", step: "03 과수원", title: "복숭아·사과 나무에서 바로", img: "/sanji/farm-peach.png", half: true },
  { key: "hands", step: "04 손 검수", title: "마지막은 사람 손으로 하나씩", img: "/sanji/farm-hands.png" },
];

function Cut({ c, reverse }: { c: (typeof CUTS)[number]; reverse: boolean }) {
  return (
    <div className={`sj-gif${c.half ? " sj-gif--half" : ""} sj-reveal`}>
      {c.video ? (
        <video className="sj-gif__media" src={c.video} autoPlay muted loop playsInline style={{ animationDirection: reverse ? "alternate-reverse" : "alternate" }} />
      ) : (
        <div className="sj-gif__media" role="img" aria-label={c.title} style={{ backgroundImage: `url(${c.img})`, animationDirection: reverse ? "alternate-reverse" : "alternate" }} />
      )}
      <div className="sj-gif__shade" />
      <div className="sj-gif__cap">
        <div className="sj-gif__step">{c.step}</div>
        <div className="sj-gif__title">{c.title}</div>
      </div>
    </div>
  );
}

export default function SanjiFarmPack() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = Array.from(root.current?.querySelectorAll<HTMLElement>(".sj-reveal") ?? []);
    if (els.length === 0) return;
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${(els.indexOf(el) % 6) * 0.12}s`;
        el.classList.add("is-in");
        io.unobserve(el);
      }
    }, { threshold: 0.2 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root}>
      <style>{`
        .sj-farm,.sj-pack{max-width:390px;margin:0 auto;color:#1a1a17;font-family:'Noto Sans KR',sans-serif;display:flex;flex-direction:column}
        .sj-farm{background:#fbf7ee;padding:24px 0 72px;gap:24px}
        .sj-pack{position:relative;overflow:hidden;background:linear-gradient(180deg,#fbf7ee 0px,#f3e6d2 140px,#f3e6d2 100%);padding:56px 24px 72px;gap:28px}
        .sj-fp-label{font-size:12px;font-weight:700;color:${ACCENT};letter-spacing:.08em}
        .sj-fp-title{font-size:28px;line-height:1.25;font-weight:900;letter-spacing:-.03em;word-break:keep-all;margin:0}
        .sj-fp-sub{font-size:14px;line-height:1.6;color:#6b675e;word-break:keep-all;margin:0}
        .sj-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .sj-reveal.is-in{opacity:1;transform:none}
        .sj-farm__head{padding:0 24px;display:flex;flex-direction:column;gap:10px}
        .sj-stats{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 24px}
        .sj-stat{background:#fff;border-radius:18px;padding:22px 18px;display:flex;flex-direction:column;gap:6px;box-shadow:0 6px 24px rgba(60,40,10,.08)}
        .sj-stat__num{font-size:34px;font-weight:900;letter-spacing:-.04em;color:${ACCENT};line-height:1}
        .sj-stat__label{font-size:13px;color:#6b675e}
        .sj-gifs{display:flex;flex-direction:column;gap:12px;padding:0 24px}
        .sj-gifs__row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .sj-gif{position:relative;height:220px;border-radius:20px;overflow:hidden;background:#e9e3d3}
        .sj-gif--half{height:200px}
        .sj-gif__media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background-size:cover;background-position:center;background-repeat:no-repeat;animation:sj-drift 13s ease-in-out infinite alternate}
        .sj-gif__shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.6) 100%)}
        .sj-gif__cap{position:absolute;left:18px;right:18px;bottom:16px;color:#fff;display:flex;flex-direction:column;gap:4px}
        .sj-gif--half .sj-gif__cap{left:14px;right:14px;bottom:14px}
        .sj-gif__step{font-size:11px;font-weight:700;opacity:.8}
        .sj-gif__title{font-size:17px;font-weight:900;letter-spacing:-.02em;word-break:keep-all}
        .sj-gif--half .sj-gif__title{font-size:14px}
        .sj-pack__head{display:flex;flex-direction:column;gap:10px;text-align:center}
        .sj-pack__photo{position:relative}
        .sj-pack__main{height:260px;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px rgba(60,40,10,.18);background:#e9e3d3}
        .sj-pack__main i{display:block;width:100%;height:100%;background-size:cover;background-position:center;animation:sj-drift 16s ease-in-out infinite alternate}
        .sj-pack__inset{position:absolute;right:-6px;bottom:-34px;width:150px;height:150px;border-radius:18px;overflow:hidden;border:5px solid #fbf7ee;box-shadow:0 12px 30px rgba(60,40,10,.22);transform:rotate(4deg);background:#e2d9c6}
        .sj-pack__inset i{display:block;width:100%;height:100%;background-size:cover;background-position:center}
        .sj-pack__list{display:flex;flex-direction:column;gap:10px;margin-top:22px}
        .sj-prow{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 6px 24px rgba(60,40,10,.06)}
        .sj-prow b{font-size:14px;font-weight:700}
        .sj-prow span{font-size:12px;color:#6b675e;white-space:nowrap;flex-shrink:0}
        .sj-prow .hot{color:${ACCENT};font-weight:700}
        @keyframes sj-drift{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.12) translate(-2%,-2%)}}
        @media (prefers-reduced-motion: reduce){.sj-reveal{opacity:1;transform:none;transition:none}.sj-gif__media,.sj-pack__main i{animation:none}}
      `}</style>

      {/* ③ OUR FARM */}
      <section className="sj-farm">
        <div className="sj-farm__head sj-reveal">
          <div className="sj-fp-label">OUR FARM</div>
          <h2 className="sj-fp-title">4만 평 밭에서<br />직접 심고, 직접 캡니다</h2>
        </div>
        <div className="sj-stats">
          <div className="sj-stat sj-reveal"><div className="sj-stat__num">4만평</div><div className="sj-stat__label">직접 운영하는 농장</div></div>
          <div className="sj-stat sj-reveal"><div className="sj-stat__num">6대째</div><div className="sj-stat__label">충북 괴산에서 농사</div></div>
        </div>
        <div className="sj-gifs">
          <Cut c={CUTS[0]} reverse={false} />
          <div className="sj-gifs__row">
            <Cut c={CUTS[1]} reverse />
            <Cut c={CUTS[2]} reverse={false} />
          </div>
          <Cut c={CUTS[3]} reverse />
        </div>
      </section>

      {/* ④ PACKING */}
      <section className="sj-pack">
        <div className="sj-pack__head sj-reveal">
          <div className="sj-fp-label">PACKING</div>
          <h2 className="sj-fp-title">정성스럽게 포장하여<br />보내드립니다</h2>
          <p className="sj-fp-sub">밭에서 캔 그대로 담고, 깨지는 건 에어캡과 이중 박스로. 파손 시 100% 재발송합니다.</p>
        </div>
        <div className="sj-pack__photo sj-reveal">
          <div className="sj-pack__main"><i role="img" aria-label="감자 포장" style={{ backgroundImage: "url(/sanji/pack-potato.png)" }} /></div>
          <div className="sj-pack__inset"><i role="img" aria-label="에어캡 포장" style={{ backgroundImage: "url(/sanji/pack-aircap.png)" }} /></div>
        </div>
        <div className="sj-pack__list">
          <div className="sj-prow sj-reveal"><b>이중 안전 포장</b><span>에어캡 + 이중 박스</span></div>
          <div className="sj-prow sj-reveal"><b>오전 10시 이전 주문</b><span>당일 발송 · 1~3일 수령</span></div>
          <div className="sj-prow sj-reveal"><b>파손 시</b><span className="hot">100% 재발송</span></div>
        </div>
      </section>
    </div>
  );
}
