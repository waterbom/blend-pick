// 산지픽 랜딩 — 첫 화면 히어로 (시안: hero.html / herospec.md 기준, 390×844 모바일 프레임)
//
// 에셋 (public/sanji/) — 없으면 자리만 비워두고 그라데이션 배경으로 대체
//   hero-farmer.png  풀블리드 배경 (가로)
//   card-basket.png  폰 목업 카드 썸네일 (세로)
//   badge-gap.png / badge-6th.png / badge-cycle.png  상단 인증 배지 (없으면 텍스트 배지)

const KAKAO =
  process.env.NEXT_PUBLIC_SANJI_KAKAO_URL ||
  process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL ||
  "http://pf.kakao.com/_VyING/chat";

const BADGES = [
  { src: "/sanji/badge-gap.png", alt: "GAP 인증", short: "GAP" },
  { src: "/sanji/badge-6th.png", alt: "6차산업 인증", short: "6차" },
  { src: "/sanji/badge-cycle.png", alt: "자연순환농법", short: "순환" },
];

// 배지 — 이미지가 있으면 배경으로 덮이고, 없으면 약칭 텍스트가 보인다
function Badge({ src, alt, short }: { src: string; alt: string; short: string }) {
  return (
    <span className="sj-badge" title={alt} role="img" aria-label={alt} style={{ backgroundImage: `url(${src})` }}>
      {short}
    </span>
  );
}

// homeHref: 로고 클릭 시 이동할 메인 주소 (산지픽 도메인이면 "/", shop 도메인 경로 접근이면 "/sanji")
export default function SanjiHero({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <section className="sj-hero">
      <style>{`
        .sj-hero{position:relative;z-index:2;width:100%;max-width:390px;height:844px;height:100svh;margin:0 auto;background:#0b150e;font-family:'Noto Sans KR',sans-serif;color:#fff}
        .sj-hero__clip{position:absolute;inset:0;overflow:hidden}
        .sj-hero__bg{position:absolute;inset:0;background-repeat:no-repeat;background-size:auto 900px;background-position:50% -40px;filter:saturate(1.1)}
        .sj-hero__fallback{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 30%,#2f5a33 0%,#183523 45%,#0b150e 100%)}
        .sj-hero__veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,20,12,.55) 0%,rgba(8,20,12,.25) 30%,rgba(8,20,12,.55) 55%,rgba(8,20,12,.94) 78%,#0b150e 100%)}
        .sj-hero__top{position:absolute;top:16px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:center;z-index:2}
        .sj-brand{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:15px;letter-spacing:-.02em;color:#fff;text-decoration:none;padding:4px 12px 4px 4px;border-radius:999px;background:rgba(251,248,241,.92);color:#2F5D34;box-shadow:0 2px 8px rgba(0,0,0,.25)}
        .sj-brand img{width:28px;height:28px;border-radius:50%;display:block}
        .sj-badges{display:flex;gap:6px}
        .sj-badge{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:1.5px solid rgba(255,255,255,.6);font-size:9px;font-weight:700;letter-spacing:-.02em;background-color:rgba(255,255,255,.12);background-size:cover;background-position:center;backdrop-filter:blur(4px);color:#fff}
        .sj-hero__copy{position:absolute;left:24px;right:24px;top:300px;display:flex;flex-direction:column;gap:14px;z-index:2;animation:sj-rise .6s ease-out both}
        .sj-headline{font-size:34px;line-height:1.22;font-weight:900;letter-spacing:-.03em;text-shadow:0 2px 14px rgba(0,0,0,.5);word-break:keep-all;margin:0}
        .sj-headline em{font-style:normal;color:#ff7a45}
        .sj-tags{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;font-weight:500;color:rgba(255,255,255,.9)}
        .sj-tags span{padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(6px);white-space:nowrap}
        .sj-cta-wrap{position:relative;margin-top:22px}
        .sj-bubble-pos{position:absolute;left:50%;top:-30px;transform:translateX(-50%);z-index:1}
        .sj-bubble{position:relative;display:flex;align-items:center;gap:6px;background:#fee500;color:#191600;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.35);text-decoration:none;animation:sj-bob 2.2s ease-in-out infinite}
        .sj-bubble::before{content:"";width:14px;height:14px;border-radius:50%;background:#191600}
        .sj-bubble::after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:#fee500;transform:translateX(-50%) rotate(45deg)}
        .sj-cta{display:flex;justify-content:center;align-items:center;gap:6px;height:54px;border-radius:16px;text-decoration:none;color:#fff;font-size:17px;font-weight:700;background:linear-gradient(95deg,#ff6a3d 0%,#ff8f3a 55%,#ffb03a 100%);box-shadow:0 10px 30px rgba(255,122,69,.45)}
        .sj-cta b{font-size:20px;line-height:1;font-weight:700}
        .sj-phone{position:absolute;left:50%;bottom:-200px;transform:translateX(-50%);width:250px;height:420px;border-radius:38px;background:#111;border:6px solid #2a2a2a;overflow:hidden;box-shadow:0 -20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08);z-index:1;animation:sj-phone-in .8s .2s ease-out both}
        .sj-phone__notch{position:absolute;top:0;left:50%;transform:translateX(-50%);width:90px;height:22px;background:#2a2a2a;border-radius:0 0 14px 14px;z-index:1}
        .sj-screen{position:absolute;inset:0;background:#fff;color:#111;padding:34px 12px 12px;display:flex;flex-direction:column;gap:10px}
        .sj-screen__head{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#444}
        .sj-screen__head .live{color:#ff6a3d}
        .sj-card{border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.12);background:#fff}
        .sj-card__thumb{position:relative;height:120px;overflow:hidden;background:linear-gradient(135deg,#f3e9d2,#dfe9d0)}
        .sj-card__thumb i{position:absolute;inset:0;background-size:cover;background-position:50% 45%}
        .sj-card__tag{position:absolute;top:8px;left:8px;background:#ff6a3d;color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px}
        .sj-card__body{padding:10px 10px 12px;display:flex;flex-direction:column;gap:6px}
        .sj-card__origin{font-size:11px;color:#777}
        .sj-card__title{font-size:13px;font-weight:700;letter-spacing:-.02em}
        .sj-card__price{display:flex;align-items:baseline;gap:6px}
        .sj-card__price .rate{font-size:12px;color:#ff6a3d;font-weight:900}
        .sj-card__price .won{font-size:15px;font-weight:900}
        .sj-bar{height:6px;border-radius:3px;background:#f0ede6;overflow:hidden}
        .sj-bar i{display:block;width:72%;height:100%;background:linear-gradient(90deg,#ff6a3d,#ffb03a)}
        .sj-card__meta{display:flex;justify-content:space-between;font-size:10px;color:#666}
        @keyframes sj-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes sj-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes sj-phone-in{from{opacity:0;transform:translate(-50%,60px)}to{opacity:1;transform:translate(-50%,0)}}
        @media (prefers-reduced-motion: reduce){.sj-hero__copy,.sj-phone,.sj-bubble{animation:none}}
      `}</style>

      {/* 배경·베일만 클립 — 폰 목업은 클립 밖이라 다음 섹션 위로 200px 걸쳐 내려온다 */}
      <div className="sj-hero__clip" aria-hidden>
        <div className="sj-hero__fallback" />
        <div className="sj-hero__bg" style={{ backgroundImage: "url(/sanji/hero-farmer.png)" }} />
        <div className="sj-hero__veil" />
      </div>

      <header className="sj-hero__top">
        <a className="sj-brand" href={homeHref} aria-label="산지픽 홈으로"><img src="/sanji/logo.png" alt="" />산지픽</a>
        <div className="sj-badges">
          {BADGES.map((b) => <Badge key={b.short} {...b} />)}
        </div>
      </header>

      <div className="sj-hero__copy">
        <h1 className="sj-headline">
          산지에서 바로,<br /><em>제철 그대로 집 앞까지</em>
        </h1>
        <div className="sj-tags">
          <span>#농가직송</span><span>#중간유통ZERO</span><span>#수확당일발송</span><span>#인플루언서검증</span>
        </div>
        <div className="sj-cta-wrap">
          <div className="sj-bubble-pos">
            <a className="sj-bubble" href={KAKAO} target="_blank" rel="noopener noreferrer">카톡 알림 1초 등록</a>
          </div>
          <a className="sj-cta" href="#deals">지금 열린 산지 공구 보기 <b>›</b></a>
        </div>
      </div>

      <div className="sj-phone" aria-hidden>
        <div className="sj-phone__notch" />
        <div className="sj-screen">
          <div className="sj-screen__head"><span>진행 중 공구</span><span className="live">LIVE ●</span></div>
          <div className="sj-card">
            <div className="sj-card__thumb">
              <i style={{ backgroundImage: "url(/sanji/card-basket.png)" }} />
              <span className="sj-card__tag">수확당일발송</span>
            </div>
            <div className="sj-card__body">
              <div className="sj-card__origin">충북 괴산 · 6대째 청년농부</div>
              <div className="sj-card__title">괴산 부사 사과 5kg 가정용</div>
              <div className="sj-card__price"><span className="rate">31%</span><span className="won">29,900원</span></div>
              <div className="sj-bar"><i /></div>
              <div className="sj-card__meta"><span>1,284명 참여</span><span>마감 2일 전</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
