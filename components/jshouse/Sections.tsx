import Link from "next/link";
import type { ReactNode } from "react";
import { AMENITIES, GLANCE, HERO, KAKAO_MAP_URL, KAKAO_URL, MARQUEE, NAVER_MAP_URL, NEIGHBORHOOD, TRANSIT, type StayConfig } from "@/components/jshouse/content";
import { QuickBar } from "@/components/jshouse/Booking";

// JS하우스 페이지의 서버 렌더 섹션들 — 움직임은 Motion.tsx 가 data-* 속성을 보고 붙인다.
//   data-reveal        화면에 들어오면 is-in (떠오르기·커튼·선 그리기)
//   data-parallax      스크롤에 따라 살짝 다른 속도로 이동
//   data-words         스크롤만큼 단어가 차오르는 문단
//   data-count         숫자 카운트업
//   data-magnetic      커서를 따라 살짝 끌려오는 버튼 (마우스 환경만)

type IconName = "bed" | "beds" | "kitchen" | "laundry" | "bath" | "air" | "arrow" | "pin" | "train" | "plane" | "walk" | "car" | "chat" | "check";
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    bed: <><path d="M3 18V7m0 8h18v3M21 15v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11" r="2" /></>,
    beds: <><path d="M2 18v-6h9v6M13 18v-6h9v6M2 15h9m2 0h9" /><path d="M4 12V9h5v3m6 0V9h5v3" /></>,
    kitchen: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M5 10h14M9 6v1.5M9 13v3" /></>,
    laundry: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4.5" /><path d="M7.5 6.2h.01M10.5 6.2h.01" /></>,
    bath: <><path d="M7 4h4v3M9 7c-2 2-3 4-3 6M12 9v2m-3-1v2m6-2v2m-6 4v2m3-2v2m3-2v2" /></>,
    air: <><rect x="3" y="5" width="18" height="8" rx="2" /><path d="M6.5 10h11M8 16c0 1.5-1 2-1 3m5-3v3m4-3c0 1.5 1 2 1 3" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    pin: <><path d="M12 21s7-6 7-11.5A7 7 0 0 0 5 9.500C5 15 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.5" /></>,
    train: <><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 11h12M9.500 14h.01M14.500 14h.01M8 21l2-4m6 4-2-4" /></>,
    plane: <path d="M10.500 13.500 3 11l1.500-1.500 7 1L16 6c1-1 3-1.500 4-.5s.5 3-.5 4l-4.500 4.500 1 7L14.500 22 12 14.500l-3 3V20l-1.500 1-.5-3.500L3.500 17l1-1.500h2.500l3.500-2Z" />,
    walk: <><circle cx="13" cy="4.500" r="1.800" /><path d="m9 21 2.500-6-2-2.500 1-5 3 1.500 1.500 3 3 1M7.500 12l1.500-4.500 2-.5m2 14-1-5" /></>,
    car: <><path d="M4 16v-3l2-5h12l2 5v3M4 16h16M4 16v2m16-2v2M6.500 13h11" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></>,
    chat: <path d="M12 4C7 4 3 7.200 3 11.200c0 2.300 1.400 4.400 3.600 5.700L6 20l3.800-2c.7.100 1.400.200 2.200.200 5 0 9-3.200 9-7.200S17 4 12 4Z" />,
    check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// 첫 화면을 여는 커튼 — CSS 애니메이션만으로 걷힌다 (스크립트가 실패해도 화면을 가리지 않는다)
export function Intro() {
  return <div className="jsh-intro" aria-hidden="true">
    <div className="jsh-intro-mark">{"JS HOUSE".split("").map((ch, i) => <span key={i} style={{ ["--i" as string]: i }}>{ch === " " ? " " : ch}</span>)}</div>
    <span className="jsh-intro-line" />
    <small>YEONNAM-DONG · SEOUL</small>
  </div>;
}

export function Header() {
  return <header className="jsh-header" data-jsh-header>
    <span className="jsh-progress" aria-hidden="true" />
    <div className="jsh-header-in">
      <a className="jsh-wordmark" href="#top" aria-label="JS하우스 처음으로">JS HOUSE<small>연남</small></a>
      <nav className="jsh-nav" aria-label="JS하우스 메뉴">
        <a href="#space">공간</a><a href="#amenities">비품</a><a href="#location">위치</a><a href="#guide">이용 안내</a><a href="#lookup">예약 조회</a>
      </nav>
      <div className="jsh-header-side">
        <Link className="jsh-by" href="/">BLEND PICK<span aria-hidden="true">↗</span></Link>
        <a className="jsh-pill" href="#reserve" data-magnetic>예약하기</a>
      </div>
    </div>
  </header>;
}

export function Hero() {
  return <section className="jsh-hero" id="top" aria-labelledby="jsh-title">
    <div className="jsh-hero-copy">
      <p className="jsh-eyebrow jsh-rise" style={{ ["--d" as string]: "0s" }}><span>YEONNAM-DONG, SEOUL</span><i aria-hidden="true" />PRIVATE STAY</p>
      <h1 className="jsh-hero-title" id="jsh-title">
        <span className="jsh-mask"><span style={{ ["--d" as string]: ".08s" }}>나무결 사이로,</span></span>
        <span className="jsh-mask"><span style={{ ["--d" as string]: ".18s" }}>고요하게 머무는</span></span>
        <span className="jsh-mask"><span style={{ ["--d" as string]: ".28s" }}><em>연남동</em>의 하루</span></span>
      </h1>
      <p className="jsh-hero-lead jsh-rise" style={{ ["--d" as string]: ".5s" }}>오크와 화이트로 채운 공간을,<br />하루 한 팀이 온전히 씁니다.</p>
      <div className="jsh-rise" style={{ ["--d" as string]: ".62s" }}><QuickBar /></div>
      <ul className="jsh-hero-meta jsh-rise" style={{ ["--d" as string]: ".74s" }} aria-label="숙소 구성">
        <li><b>2</b>침실</li><li><b>3</b>침대</li><li>주방</li><li>세탁실</li>
      </ul>
    </div>
    <div className="jsh-hero-visual">
      <figure className="jsh-hero-main">
        {/* 첫 화면에서 가장 큰 사진 — 숨기지 않고 바로 그린다 (LCP) */}
        <img src={HERO.main.src} alt={HERO.mainAlt} width={952} height={1269} fetchPriority="high" decoding="sync" />
      </figure>
      <figure className="jsh-hero-sub" data-parallax="-0.10">
        <img src={HERO.sub.small} alt={HERO.subAlt} width={520} height={693} loading="eager" />
      </figure>
      <div className="jsh-seal" aria-hidden="true" data-parallax="0.06">
        <svg viewBox="0 0 120 120"><defs><path id="jsh-seal-path" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" /></defs>
          <text><textPath href="#jsh-seal-path" startOffset="0" textLength="284" lengthAdjust="spacing">JS HOUSE · YEONNAM-DONG · PRIVATE STAY ·</textPath></text></svg>
        <span>JS</span>
      </div>
    </div>
    <a className="jsh-scroll-cue" href="#glance"><span>SCROLL</span><i aria-hidden="true" /></a>
  </section>;
}

export function Marquee() {
  const row = <span className="jsh-marquee-row">{MARQUEE.map(t => <span key={t}>{t}<i aria-hidden="true">✳</i></span>)}</span>;
  return <div className="jsh-marquee" aria-hidden="true"><div className="jsh-marquee-track">{row}{row}{row}</div></div>;
}

// 스크롤만큼 단어가 진해지는 문단
function Words({ text }: { text: string }) {
  return <p className="jsh-words" data-words aria-label={text}>{text.split(" ").map((w, i) => <span key={i} aria-hidden="true">{w} </span>)}</p>;
}

export function Glance() {
  return <section className="jsh-section jsh-glance" id="glance" aria-labelledby="jsh-glance-title">
    <div className="jsh-wrap jsh-glance-grid">
      <div>
        <p className="jsh-label" data-reveal="up">AT A GLANCE<span>한눈에 보기</span></p>
        <h2 className="jsh-h2" id="jsh-glance-title" data-reveal="up">연남동에서,<br />집처럼 머무는 며칠.</h2>
        <Words text="JS하우스는 연남동에 자리한 프라이빗 스테이입니다. 따뜻한 오크와 밝은 벽, 은은한 간접조명으로 채운 공간. 두 개의 침실과 주방, 세탁실까지 한 팀이 온전히 쓰는 곳에서 여행의 속도를 늦춰 보세요." />
      </div>
      <ul className="jsh-facts">
        {GLANCE.map((g, i) => <li key={g.title} data-reveal="up" style={{ ["--i" as string]: i }}>
          <span className="jsh-fact-icon"><Icon name={g.icon} size={24} /></span>
          <strong>{g.value !== undefined ? <><b data-count={g.value}>{g.value}</b><small>{g.unit}</small></> : <b className="jsh-fact-word">{g.title}</b>}</strong>
          <span className="jsh-fact-title">{g.value !== undefined ? g.title : g.note}</span>
          {g.value !== undefined && <span className="jsh-fact-note">{g.note}</span>}
        </li>)}
      </ul>
    </div>
  </section>;
}

export function Amenities() {
  return <section className="jsh-section jsh-amenities" id="amenities" aria-labelledby="jsh-amen-title">
    <div className="jsh-wrap">
      <div className="jsh-section-head">
        <p className="jsh-label" data-reveal="up">AMENITIES<span>갖춰 둔 것들</span></p>
        <h2 className="jsh-h2" id="jsh-amen-title" data-reveal="up">몸만 와도 되도록.</h2>
      </div>
      <div className="jsh-amen-grid">
        {AMENITIES.map((group, g) => <div className="jsh-amen-group" key={group.group} data-reveal="up" style={{ ["--i" as string]: g }}>
          <h3><span>{String(g + 1).padStart(2, "0")}</span>{group.group}</h3>
          <ul>{group.items.map((item, i) => <li key={item} style={{ ["--j" as string]: i }}><Icon name="check" size={15} />{item}</li>)}</ul>
        </div>)}
      </div>
      <p className="jsh-fine" data-reveal="up">사진으로 확인되는 비품을 적었어요. 더 궁금한 물건은 <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">카카오 상담</a>으로 물어봐 주세요.</p>
    </div>
  </section>;
}

// 동네 약도 — 실제 축척이 아닌 그림 지도. 선이 그려지고 핀이 내려앉는 움직임은 CSS(.is-in)로.
function AreaMap({ pinLabel }: { pinLabel: string }) {
  return <figure className="jsh-map" data-reveal="map">
    <svg viewBox="0 0 600 440" role="img" aria-label="연남동 약도: 홍대입구역 북서쪽, 경의선숲길을 따라 이어지는 연남동에 JS하우스가 있습니다.">
      <defs>
        <pattern id="jsh-map-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1.500" cy="1.500" r="1" fill="currentColor" opacity=".13" /></pattern>
        <radialGradient id="jsh-map-glow"><stop offset="0" stopColor="#D9A566" stopOpacity=".55" /><stop offset="1" stopColor="#D9A566" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="440" fill="url(#jsh-map-dots)" />
      {/* 연남동 영역 */}
      <path className="jsh-map-area" d="M118 96c40-34 120-40 176-18 44 18 74 62 70 108-4 50-46 86-98 96-58 12-128-6-160-52-28-42-24-104 12-134Z" />
      <circle className="jsh-map-glow" cx="236" cy="176" r="96" fill="url(#jsh-map-glow)" />
      {/* 경의선숲길 */}
      <path className="jsh-map-park" pathLength={1} d="M76 60C150 120 230 186 318 262c26 22 52 42 78 60" />
      <path className="jsh-map-park-dash" d="M76 60C150 120 230 186 318 262c26 22 52 42 78 60" />
      {/* 2호선 */}
      <path className="jsh-map-line jsh-map-line-2" pathLength={1} d="M250 420c50-30 100-64 146-98 46-34 96-52 150-60 20-3 38-5 54-6" />
      {/* 공항철도 · 경의중앙선 */}
      <path className="jsh-map-line jsh-map-line-a" pathLength={1} d="M20 300c120 10 250 18 376 22 60 2 110 4 150 10l54 8" />
      <circle className="jsh-map-train" r="5"><animateMotion dur="7s" repeatCount="indefinite" path="M20 300c120 10 250 18 376 22 60 2 110 4 150 10l54 8" /></circle>
      {/* 홍대입구역 */}
      <g className="jsh-map-station"><circle cx="396" cy="322" r="11" /><circle cx="396" cy="322" r="4.500" /></g>
      {/* 숙소 핀 */}
      <g className="jsh-map-pin" transform="translate(236 176)">
        <circle className="jsh-map-ripple" r="16" /><circle className="jsh-map-ripple jsh-map-ripple-2" r="16" />
        <path d="M0-34c-11 0-19 8.500-19 18.500C-19-3 0 16 0 16s19-19 19-31.500C19-25.500 11-34 0-34Z" />
        <text y="-11" textAnchor="middle">JS</text>
      </g>
      {/* 걷는 길 */}
      <path className="jsh-map-walk" pathLength={1} d="M386 312C340 280 290 236 246 196" />
      <g className="jsh-map-labels">
        <text x="412" y="352" className="jsh-map-strong">홍대입구역</text>
        <text x="412" y="370">2호선 · 공항철도 · 경의중앙선</text>
        <text x="92" y="50" className="jsh-map-green">경의선숲길 (연트럴파크)</text>
        <text x="150" y="246" className="jsh-map-area-name">연남동</text>
        <text x="434" y="246">신촌 →</text>
        <text x="270" y="412">↙ 합정 · 망원</text>
        <text x="28" y="288">← 인천 · 김포공항</text>
        <text x="330" y="74">연희동 ↗</text>
        <text x="430" y="408" className="jsh-map-strong">홍대 거리</text>
      </g>
      <g className="jsh-map-tag" transform="translate(262 150)"><rect x="0" y="-15" rx="13" width={Math.max(96, pinLabel.length * 12.500 + 26)} height="27" /><text x="13" y="3">{pinLabel}</text></g>
    </svg>
    <figcaption>동네를 한눈에 보는 약도예요. 실제 거리·방향과는 차이가 있어요.</figcaption>
  </figure>;
}

export function Location({ config }: { config: StayConfig }) {
  return <section className="jsh-section jsh-location" id="location" aria-labelledby="jsh-loc-title">
    <div className="jsh-wrap">
      <div className="jsh-loc-grid">
        <div className="jsh-loc-copy">
          <p className="jsh-label" data-reveal="up">LOCATION<span>위치</span></p>
          <h2 className="jsh-h2" id="jsh-loc-title" data-reveal="up">숲길을 걷다 보면,<br /><em>연남동.</em></h2>
          <p className="jsh-lead" data-reveal="up">홍대입구역에서 경의선숲길 방향. 카페와 산책길이 이어지는 연남동에 있어요.</p>
          <dl className="jsh-address" data-reveal="up">
            <div><dt><Icon name="pin" size={18} />주소</dt><dd>{config.address || <>서울 마포구 연남동<small>상세 주소는 예약 확정 후 안내드려요</small></>}</dd></div>
            <div><dt><Icon name="walk" size={18} />오시는 길</dt><dd>{config.walkNote || <>홍대입구역에서 경의선숲길 방향<small>자세한 길은 예약 확정 문자로 알려드려요</small></>}</dd></div>
            {config.parkingNote && <div><dt><Icon name="car" size={18} />주차</dt><dd>{config.parkingNote}</dd></div>}
          </dl>
          <div className="jsh-map-links" data-reveal="up">
            {config.mapUrl && <a className="jsh-btn jsh-btn-light" href={config.mapUrl} target="_blank" rel="noopener noreferrer" data-magnetic>지도에서 위치 보기<Icon name="arrow" size={17} /></a>}
            <a className="jsh-btn jsh-btn-ghost" href={NAVER_MAP_URL} target="_blank" rel="noopener noreferrer">네이버 지도로 연남동 보기</a>
            <a className="jsh-btn jsh-btn-ghost" href={KAKAO_MAP_URL} target="_blank" rel="noopener noreferrer">카카오맵</a>
          </div>
        </div>
        <AreaMap pinLabel={config.address ? "JS하우스" : "JS하우스 · 연남동"} />
      </div>
      <ul className="jsh-transit" aria-label="교통">
        {TRANSIT.map((t, i) => <li key={t.label} data-reveal="up" style={{ ["--i" as string]: i }}>
          <span className="jsh-transit-icon"><Icon name={i === 0 ? "train" : "plane"} size={20} /></span>
          <small>{t.label}</small><strong>{t.value}</strong><span>{t.note}</span>
        </li>)}
      </ul>
      <div className="jsh-hood">
        <h3 className="jsh-h3" data-reveal="up">걸어서 만나는 동네</h3>
        <ol>{NEIGHBORHOOD.map((n, i) => <li key={n.key} data-reveal="up" style={{ ["--i" as string]: i }}>
          <span>{String(i + 1).padStart(2, "0")}</span><h4>{n.title}</h4><p>{n.body}</p>
        </li>)}</ol>
      </div>
    </div>
  </section>;
}

export function Guide({ config }: { config: StayConfig }) {
  const rules = config.rules.split("\n").map(line => line.trim()).filter(Boolean);
  const items: { q: string; a: ReactNode }[] = [
    { q: "예약은 어떻게 진행되나요?", a: <>달력에서 날짜를 고르고 예약을 신청하면, 일정을 확인한 뒤 확정 여부와 결제 방법을 문자로 안내드려요. 신청 단계에서는 결제하지 않습니다.</> },
    { q: "체크인·체크아웃은 몇 시인가요?", a: config.checkInTime || config.checkOutTime
      ? <>체크인 <b>{config.checkInTime || "별도 안내"}</b> · 체크아웃 <b>{config.checkOutTime || "별도 안내"}</b> 입니다.</>
      : <>입실·퇴실 시간과 들어오는 방법은 예약 확정 문자에서 함께 알려드려요.</> },
    { q: "몇 명까지 머물 수 있나요?", a: <>침대는 라지 1개와 싱글 2개가 있어요. 예약 신청은 최대 <b>{config.maxGuests}명</b>까지 받고 있습니다.</> },
    { q: "신청을 취소하고 싶어요.", a: <>확정 전 신청은 아래 <a href="#lookup">예약 조회</a>에서 바로 취소할 수 있어요. 이미 확정된 예약은 조회 화면에서 취소 요청을 남기면 확인 후 연락드립니다.</> },
    ...(rules.length ? [{ q: "머무는 동안 지켜 주세요", a: <ul className="jsh-rules">{rules.map(rule => <li key={rule}>{rule}</li>)}</ul> }] : []),
    { q: "더 궁금한 점이 있어요.", a: <>블랜드픽 <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">카카오 상담</a>으로 편하게 물어봐 주세요. JS하우스 문의라고 말씀해 주시면 빠르게 도와드려요.</> },
  ];
  return <section className="jsh-section jsh-guide" id="guide" aria-labelledby="jsh-guide-title">
    <div className="jsh-wrap jsh-guide-grid">
      <div className="jsh-section-head">
        <p className="jsh-label" data-reveal="up">GUIDE<span>이용 안내</span></p>
        <h2 className="jsh-h2" id="jsh-guide-title" data-reveal="up">머물기 전에<br />알아 둘 것들.</h2>
        <a className="jsh-text-link" href={KAKAO_URL} target="_blank" rel="noopener noreferrer" data-reveal="up"><Icon name="chat" size={18} />카카오로 문의하기</a>
      </div>
      <div className="jsh-faq">
        {items.map((item, i) => <details key={item.q} data-reveal="up" style={{ ["--i" as string]: i }} open={i === 0}>
          <summary><span>{String(i + 1).padStart(2, "0")}</span>{item.q}<i aria-hidden="true" /></summary>
          <div className="jsh-faq-body"><div>{item.a}</div></div>
        </details>)}
      </div>
    </div>
  </section>;
}

export function Closing() {
  return <section className="jsh-closing" aria-label="예약 안내">
    <div className="jsh-closing-photo" aria-hidden="true"><img src="/hotel/jshouse/twin.webp" alt="" loading="lazy" data-parallax="0.12" /></div>
    <div className="jsh-closing-in">
      <p className="jsh-label" data-reveal="up">JS HOUSE × BLEND PICK</p>
      <h2 data-reveal="up"><span>연남동에서,</span> <em>천천히.</em></h2>
      <a className="jsh-btn jsh-btn-light jsh-btn-lg" href="#reserve" data-reveal="up" data-magnetic>예약 가능한 날짜 보기<Icon name="arrow" size={19} /></a>
      <p className="jsh-closing-by" data-reveal="up">블랜드픽에서 예약을 받는 숙소예요. <Link href="/">블랜드픽 둘러보기 ↗</Link></p>
    </div>
  </section>;
}
