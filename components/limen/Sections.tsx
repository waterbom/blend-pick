import { LIMEN_ARTWORK } from "@/lib/limen-artwork";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AMENITIES, BRAND, CLOSING, CLOSING_PHOTO, DOOR_SIZES, HOSTING, KAKAO_MAP_URL, KAKAO_URL, NAVER_MAP_URL, NEIGHBORHOOD, PASSAGE, PASSAGE_PHOTO,
  RATE_ROWS, ROOMS, ROOM_KEYS, STAY_FACILITIES, STAY_HOUSE_RULES, STAY_SNAPSHOT_PHOTOS, STAY_STANDARD_HOURS, STORY, STORY_PHOTO, TRANSIT, VALUES, srcSet, type StayConfig,
} from "@/components/limen/content";
import { QuickBar, RoomCta } from "@/components/limen/Booking";
import Menu from "@/components/limen/Menu";
import { SEASON_GUIDE } from "@/lib/limen-policy.cjs";

// LIMEN 페이지의 서버 렌더 섹션들 — 움직임은 Motion.tsx 가 data-* 속성을 보고 붙인다.
//   data-reveal          화면에 들어오면 is-in (글은 떠오르고, "door" 는 문이 열리듯 드러난다)
//   data-scene           고정 구간을 지나는 진행도(--p)를 받는 장면
//   data-parallax        스크롤에 따라 살짝 다른 속도로 이동
//   data-words           스크롤만큼 단어가 차오르는 문장
//   data-focus           터치 화면에서 화면 가운데를 지날 때 강조 (마우스를 올렸을 때와 같은 표시)
// 브랜드 문구는 content.ts 에 있고, 숙소가 보낸 브랜드 문서의 문장을 그대로 쓴다.

const delay = (i: number, key = "--i") => ({ [key]: i }) as CSSProperties;
const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

type IconName = "arrow" | "pin" | "train" | "plane" | "walk" | "car" | "chat" | "check";
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    pin: <><path d="M12 21s7-6 7-11.5A7 7 0 0 0 5 9.5C5 15 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
    train: <><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 11h12M9.5 14h.01M14.5 14h.01M8 21l2-4m6 4-2-4" /></>,
    plane: <path d="M10.5 13.5 3 11l1.5-1.5 7 1L16 6c1-1 3-1.5 4-.5s.5 3-.5 4l-4.5 4.5 1 7L14.5 22 12 14.5l-3 3V20l-1.5 1-.5-3.5L3.5 17l1-1.5h2.500l3.5-2Z" />,
    walk: <><circle cx="13" cy="4.5" r="1.800" /><path d="m9 21 2.5-6-2-2.5 1-5 3 1.5 1.5 3 3 1M7.5 12 9 7.5l2-.5m2 14-1-5" /></>,
    car: <><path d="M4 16v-3l2-5h12l2 5v3M4 16h16M4 16v2m16-2v2M6.5 13h11" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></>,
    chat: <path d="M12 4C7 4 3 7.200 3 11.200c0 2.300 1.400 4.400 3.600 5.700L6 20l3.800-2c.7.100 1.400.200 2.200.200 5 0 9-3.200 9-7.200S17 4 12 4Z" />,
    check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// 문턱 표식 — 아치형 문과 그 아래 문턱 선. 정식 로고를 받기 전까지 워드마크 옆에 작게 쓴다.
export function Mark({ size = 28 }: { size?: number }) {
  return <svg className="lm-mark" width={size * 0.75} height={size} viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 29V12a7 7 0 0 1 14 0v17" /><path d="M1 29h22" />
  </svg>;
}

// 첫 화면을 여는 문 — 두 문짝이 양옆으로 열린다. CSS 애니메이션만 쓰므로 스크립트가 실패해도 화면을 가리지 않는다.
export function Intro() {
  return <div className="lm-intro" aria-hidden="true">
    <span className="lm-intro-leaf" /><span className="lm-intro-leaf" />
    <div className="lm-intro-mark"><Mark size={34} /><b>{BRAND.name}</b><small>{BRAND.tagline}</small></div>
  </div>;
}

export function Header() {
  return <header className="lm-header" data-lm-header>
    <span className="lm-progress" aria-hidden="true" />
    <div className="lm-header-in">
      <a className="lm-wordmark" href="#top" aria-label="LIMEN 처음으로">{BRAND.name}</a>
      <nav className="lm-nav" aria-label="LIMEN 메뉴">
        <a href="#rooms">객실·요금</a><a href="#space">공간</a><a href="#location">위치</a><a href="#guide">이용 안내</a><a href="#story">스토리</a>
      </nav>
      <div className="lm-header-side">
        <a className="lm-header-link" href="#lookup">예약 조회</a>
        <a className="lm-pill" href="#reserve">예약하기</a>
        <Menu />
      </div>
    </div>
  </header>;
}

export function Hero() {
  return <section className="lm-hero" id="top" aria-labelledby="lm-title">
    <span className="lm-hero-ghost" aria-hidden="true">{BRAND.name}</span>
    <div className="lm-hero-copy">
      <p className="lm-kicker lm-rise" style={delay(0, "--d")}>PRIVATE STAY<i aria-hidden="true" />{BRAND.place}</p>
      <h1 className="lm-hero-title" id="lm-title">
        <span className="lm-sr">LIMEN 리멘 — 연남동 프라이빗 스테이. </span>
        {BRAND.taglineKo.map((line, i) => <span className="lm-mask" key={line}><span style={delay(i, "--d")}>{line}</span></span>)}
      </h1>
      <p className="lm-hero-en lm-rise" style={delay(3, "--d")}>{BRAND.tagline}</p>
      <div className="lm-rise lm-hero-quick" style={delay(4, "--d")}><QuickBar /></div>
    </div>
    <div className="lm-hero-visual">
      <figure className="lm-door lm-hero-door">
        <img {...LIMEN_ARTWORK} fetchPriority="high" decoding="async" />
      </figure>
      <p className="lm-hero-note lm-rise" style={delay(5, "--d")}><b>LIMEN</b>라틴어로 ‘문턱’</p>
    </div>
    <a className="lm-scroll" href="#stay"><span>SCROLL</span><i aria-hidden="true" /></a>
  </section>;
}

// 스크롤만큼 단어가 진해지는 문장
function Words({ text, className }: { text: string; className: string }) {
  return <p className={className} data-words aria-label={text}>{text.split(" ").map((w, i) => <span key={i} aria-hidden="true">{w} </span>)}</p>;
}

function Label({ no, children }: { no: string; children: ReactNode }) {
  return <p className="lm-label" data-reveal><b>{no}</b><span>{children}</span></p>;
}

export function StaySnapshot() {
  return <section className="lm-section lm-snapshot" id="stay" aria-labelledby="lm-stay-title">
    <div className="lm-wrap lm-snapshot-grid">
      <div className="lm-snapshot-copy">
        <Label no="01">YEONNAM STAY</Label>
        <h2 className="lm-h2" id="lm-stay-title" data-reveal>연남 골목 안,<br />한 팀을 위한 쉼</h2>
        <p className="lm-lead" data-reveal>오크와 돌, 리넨으로 마감한 프라이빗 스테이. 창가에서 식사를 하고, 경의선숲길을 걸으며 연남동에 머물러 보세요.</p>
        <div className="lm-snapshot-links" data-reveal>
          <a className="lm-btn lm-btn-dark" href="#rooms">객실과 요금<Icon name="arrow" size={17} /></a>
          <a className="lm-btn lm-btn-line" href="#amenities">객실 비품 보기</a>
        </div>
      </div>
      <div className="lm-snapshot-photos">
        {STAY_SNAPSHOT_PHOTOS.map(({ photo, alt, label }) => <figure key={photo.src} data-reveal>
          <img src={photo.src} srcSet={srcSet(photo)} sizes="(max-width: 640px) 43vw, (max-width: 960px) 42vw, 24vw" alt={alt} width={952} height={1269} loading="lazy" decoding="async" />
          <figcaption>{label}</figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
}

// — 브랜드를 정의하는 한 문장 + 이름의 뜻
export function Definition() {
  return <section className="lm-section lm-definition" id="definition" aria-label="브랜드 정의">
    <div className="lm-wrap">
      <Label no="—">BRAND DEFINITION</Label>
      <Words className="lm-statement" text={BRAND.definition} />
      <div className="lm-naming" data-reveal>
        <div className="lm-naming-word"><Mark size={40} /><strong>{BRAND.name}</strong><span>LATIN — {BRAND.naming.title}</span></div>
        <p>{BRAND.naming.body.map(line => <span key={line}>{line}</span>)}</p>
      </div>
    </div>
  </section>;
}

// 문을 지나는 장면 — 스크롤하는 동안 화면이 고정되고, 가운데 문이 열리며 주변이 어두워진다 (--p: 0 → 1)
export function Passage() {
  return <section className="lm-passage" data-scene aria-label="문을 지나는 장면">
    <div className="lm-passage-stage">
      <figure className="lm-passage-door"><img src={PASSAGE_PHOTO.photo.src} srcSet={srcSet(PASSAGE_PHOTO.photo)} sizes={DOOR_SIZES} alt={PASSAGE_PHOTO.alt} width={952} height={1269} loading="lazy" decoding="async" /></figure>
      <p className="lm-passage-text">{PASSAGE.map((line, i) => <span key={line} style={delay(i)}>{line}</span>)}</p>
      <span className="lm-passage-sill" aria-hidden="true" />
    </div>
  </section>;
}

// 07 — LIMEN을 시작한 이유
export function Story() {
  return <section className="lm-section lm-story" id="story" aria-labelledby="lm-story-title">
    <div className="lm-wrap lm-story-grid">
      <div className="lm-story-head">
        <Label no="07">WHY LIMEN</Label>
        <h2 className="lm-h2" id="lm-story-title" data-reveal>LIMEN을<br />시작한 이유</h2>
        <figure className="lm-door lm-story-photo" data-reveal="door"><img src={STORY_PHOTO.photo.src} srcSet={srcSet(STORY_PHOTO.photo)} sizes={DOOR_SIZES} alt={STORY_PHOTO.alt} width={952} height={1269} loading="lazy" decoding="async" data-parallax="-0.05" /></figure>
      </div>
      <div className="lm-story-body">
        <p className="lm-story-lead" data-reveal>{STORY.lead}</p>
        {STORY.body.slice(0, 2).map(text => <p key={text} data-reveal>{text}</p>)}
        <blockquote data-reveal>{STORY.quote}</blockquote>
        {STORY.body.slice(2).map(text => <p key={text} data-reveal>{text}</p>)}
      </div>
    </div>
  </section>;
}

// 08 — 우리가 지향하는 가치
export function Values() {
  return <section className="lm-section lm-values" id="values" aria-labelledby="lm-values-title">
    <div className="lm-wrap">
      <div className="lm-head">
        <Label no="08">CORE VALUES</Label>
        <h2 className="lm-h2" id="lm-values-title" data-reveal>우리가 지향하는 가치</h2>
      </div>
      <ol className="lm-value-list">
        {VALUES.map((value, i) => <li key={value.en} data-reveal data-focus style={delay(i)}>
          <span className="lm-value-no">{String(i + 1).padStart(2, "0")}</span>
          <h3>{value.en}<small>{value.ko}</small></h3>
          <p>{value.body.map(line => <span key={line}>{line}</span>)}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}

// 02 — 객실과 요금. 금액·인원은 관리자 설정(config.rooms)을 그대로 보여 준다.
// 준성수기·극성수기 기간은 서버가 요금을 계산할 때 쓰는 시즌 달력(lib/limen-policy.cjs)의 안내문을 그대로 쓴다.
export function Rooms({ config }: { config: StayConfig }) {
  const fromPrice = (key: "one" | "two") => {
    const prices = RATE_ROWS.map(row => config.rooms[key][row.key]).filter((v): v is number => typeof v === "number");
    return prices.length ? Math.min(...prices) : null;
  };
  // 연박은 1박 요금의 합 — 가장 낮은 요금과 가장 높은 요금으로 범위를 보여 준다
  const range = (key: "one" | "two", nights: number) => {
    const prices = RATE_ROWS.map(row => config.rooms[key][row.key]).filter((v): v is number => typeof v === "number");
    if (prices.length !== RATE_ROWS.length) return "문의";
    return `${(Math.min(...prices) * nights).toLocaleString("ko-KR")}–${won(Math.max(...prices) * nights)}`;
  };
  return <section className="lm-section lm-rooms" id="rooms" aria-labelledby="lm-rooms-title">
    <div className="lm-wrap">
      <div className="lm-head">
        <Label no="02">ROOMS &amp; RATES</Label>
        <h2 className="lm-h2" id="lm-rooms-title" data-reveal>객실과 요금</h2>
      </div>
      <div className="lm-room-grid">
        {ROOM_KEYS.map((key, i) => {
          const room = ROOMS[key], rates = config.rooms[key], from = fromPrice(key);
          return <article className="lm-room" key={key} data-reveal style={delay(i)}>
            <figure className="lm-door lm-room-photo" data-reveal="door"><img src={room.photo.src} srcSet={srcSet(room.photo)} sizes="(max-width: 640px) 60vw, 22vw" alt={room.alt} width={952} height={1269} loading="lazy" decoding="async" /></figure>
            <p className="lm-room-en">{room.en}</p>
            <h3>{room.name}<small>{rates.guests}인</small></h3>
            <p className="lm-room-summary">{room.summary}</p>
            <dl>
              <div><dt>기준 / 최대</dt><dd>{rates.guests}인 / {rates.guests}인</dd></div>
              <div><dt>인원 추가</dt><dd>불가</dd></div>
              <div><dt>1박</dt><dd>{from !== null ? <><b>{won(from)}</b>부터</> : "문의"}</dd></div>
            </dl>
            <RoomCta room={key} />
          </article>;
        })}
      </div>
      <div className="lm-rates" data-reveal>
        <div className="lm-rates-head"><h3>객실 요금 안내</h3><span>ROOM RATE INFORMATION · 1박</span></div>
        <table>
          <thead><tr><th scope="col">구분</th>{ROOM_KEYS.map(key => <th scope="col" key={key}>{ROOMS[key].name} · {config.rooms[key].guests}인</th>)}</tr></thead>
          <tbody>
            {RATE_ROWS.map(row => <tr key={row.key}>
              <th scope="row">{row.label}{row.note && <small>{(row.key === "shoulder" || row.key === "peak") && !config.autoSeasons ? "달력에 표시" : row.note}</small>}</th>
              {ROOM_KEYS.map(key => { const price = config.rooms[key][row.key]; return <td key={key}>{typeof price === "number" ? won(price) : "문의"}</td>; })}
            </tr>)}
          </tbody>
        </table>
        <div className="lm-rates-long">
          <h4>연박</h4>
          <dl>
            {[5, 7].map(nights => <div key={nights}><dt>{nights}박</dt>{ROOM_KEYS.map(key => <dd key={key}><small>{ROOMS[key].name}</small>{range(key, nights)}</dd>)}</div>)}
          </dl>
        </div>
        <ul className="lm-rates-notes">
          <li>모든 요금은 객실당 기준이며, 기준 인원을 초과한 입실은 불가합니다.</li>
          {config.autoSeasons
            ? <>{SEASON_GUIDE.map(line => <li key={line.key}><span><b>{line.label}</b> {line.text}</span></li>)}
              <li>시즌은 일부 날짜에서 달라질 수 있으며, 날짜별 요금은 예약 달력에 표시됩니다.</li></>
            : <li>준성수기·극성수기는 날짜로 지정되며, 예약 달력에 그날의 요금이 표시됩니다.</li>}
          <li>연박 요금은 머무는 날짜의 1박 요금을 더한 금액입니다.</li>
        </ul>
      </div>
    </div>
  </section>;
}

// 사진으로 확인되는 비품 (공간 둘러보기 아래)
export function Amenities() {
  return <section className="lm-section lm-amenities" id="amenities" aria-labelledby="lm-amen-title">
    <div className="lm-wrap">
      <div className="lm-stay-facilities">
        <p className="lm-label" data-reveal><b>—</b><span>AMENITIES &amp; SERVICES</span></p>
        <h2 className="lm-h3" id="lm-amen-title" data-reveal>머무는 동안</h2>
        <ul className="lm-stay-facilities-grid">
          {STAY_FACILITIES.map(({ title, body }) => <li key={title} data-reveal><h3>{title}</h3><p>{body}</p></li>)}
        </ul>
      </div>
    </div>
    <div className="lm-wrap lm-amen-wrap">
      <div className="lm-head">
        <p className="lm-label" data-reveal><b>—</b><span>AMENITIES</span></p>
        <h3 className="lm-h3" data-reveal>객실별 비품</h3>
        <p className="lm-fine" data-reveal>침구와 주방 기기 등 객실별 구성을 확인하세요. 더 궁금한 것은 <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">카카오 상담</a>으로 물어봐 주세요.</p>
      </div>
      <div className="lm-amen-rooms">
        {ROOM_KEYS.map(key => <div className="lm-amen-room" key={key} data-reveal>
          <h3>{ROOMS[key].name}<small>{ROOMS[key].en}</small></h3>
          <div className="lm-amen-grid">
            {AMENITIES[key].map(group => <div className="lm-amen-group" key={group.group}>
              <h4>{group.group}</h4>
              <ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
            </div>)}
          </div>
        </div>)}
      </div>
    </div>
  </section>;
}

// 동네 약도 — 실제 축척이 아닌 그림 지도. 선이 그려지고 핀이 내려앉는 움직임은 CSS(.is-in)로.
function AreaMap() {
  return <figure className="lm-map" data-reveal="map">
    <svg viewBox="0 0 600 440" role="img" aria-label="연남동 약도: 홍대입구역 북서쪽, 경의선숲길을 따라 이어지는 연남동에 LIMEN이 있습니다.">
      <defs>
        <pattern id="lm-map-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="currentColor" opacity=".12" /></pattern>
        <radialGradient id="lm-map-glow"><stop offset="0" stopColor="#C9A77C" stopOpacity=".5" /><stop offset="1" stopColor="#C9A77C" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="440" fill="url(#lm-map-dots)" />
      {/* 연남동 영역 */}
      <path className="lm-map-area" d="M118 96c40-34 120-40 176-18 44 18 74 62 70 108-4 50-46 86-98 96-58 12-128-6-160-52-28-42-24-104 12-134Z" />
      <circle cx="236" cy="176" r="96" fill="url(#lm-map-glow)" />
      {/* 경의선숲길 */}
      <path className="lm-map-park" pathLength={1} d="M76 60C150 120 230 186 318 262c26 22 52 42 78 60" />
      {/* 2호선 */}
      <path className="lm-map-line lm-map-line-2" pathLength={1} d="M250 420c50-30 100-64 146-98 46-34 96-52 150-60 20-3 38-5 54-6" />
      {/* 공항철도 · 경의중앙선 */}
      <path className="lm-map-line lm-map-line-a" pathLength={1} d="M20 300c120 10 250 18 376 22 60 2 110 4 150 10l54 8" />
      <circle className="lm-map-train" r="4"><animateMotion dur="8s" repeatCount="indefinite" path="M20 300c120 10 250 18 376 22 60 2 110 4 150 10l54 8" /></circle>
      {/* 홍대입구역 */}
      <g className="lm-map-station"><circle cx="396" cy="322" r="10" /><circle cx="396" cy="322" r="4" /></g>
      {/* 걷는 길 */}
      <path className="lm-map-walk" pathLength={1} d="M386 312C340 280 290 236 246 196" />
      {/* 숙소 — 문 모양 핀 */}
      <g className="lm-map-pin" transform="translate(236 176)">
        <circle className="lm-map-ripple" r="16" /><circle className="lm-map-ripple lm-map-ripple-2" r="16" />
        <path d="M-11 10v-22a11 11 0 0 1 22 0v22Z" /><path className="lm-map-pin-sill" d="M-16 10h32" />
      </g>
      <g className="lm-map-labels">
        <text x="412" y="352" className="lm-map-strong">홍대입구역</text>
        <text x="412" y="370">2호선 · 공항철도 · 경의중앙선</text>
        <text x="92" y="50" className="lm-map-green">경의선숲길 (연트럴파크)</text>
        <text x="146" y="252" className="lm-map-area-name">연남동</text>
        <text x="434" y="246">신촌 →</text>
        <text x="270" y="412">↙ 합정 · 망원</text>
        <text x="28" y="288">← 인천 · 김포공항</text>
        <text x="330" y="74">연희동 ↗</text>
        <text x="430" y="408" className="lm-map-strong">홍대 거리</text>
        <text x="258" y="170" className="lm-map-name">LIMEN</text>
      </g>
    </svg>
    <figcaption>동네를 한눈에 보는 약도입니다. 실제 거리·방향과는 차이가 있습니다.</figcaption>
  </figure>;
}

// 04 — 위치 (어두운 구간)
export function Location({ config }: { config: StayConfig }) {
  return <section className="lm-section lm-location" id="location" aria-labelledby="lm-loc-title">
    <div className="lm-wrap">
      <div className="lm-loc-grid">
        <div className="lm-loc-copy">
          <Label no="04">LOCATION</Label>
          <h2 className="lm-h2" id="lm-loc-title" data-reveal>홍대와 연남동,<br />그 한가운데의 고요.</h2>
          <p className="lm-lead" data-reveal>서울에서 가장 활기찬 동네의 중심, 홍대입구역에서 경의선숲길 방향에 있습니다.</p>
          <dl className="lm-address" data-reveal>
            <div><dt><Icon name="pin" size={17} />주소</dt><dd>{config.address || <>서울 마포구 연남동<small>상세 주소는 예약 확정 후 안내드립니다</small></>}</dd></div>
            <div><dt><Icon name="walk" size={17} />오시는 길</dt><dd>{config.walkNote || <>홍대입구역에서 경의선숲길 방향<small>자세한 길은 예약 확정 문자로 알려드립니다</small></>}</dd></div>
            {config.parkingNote && <div><dt><Icon name="car" size={17} />주차</dt><dd>{config.parkingNote}</dd></div>}
          </dl>
          <div className="lm-map-links" data-reveal>
            {config.mapUrl && <a className="lm-btn lm-btn-light" href={config.mapUrl} target="_blank" rel="noopener noreferrer">지도에서 위치 보기<Icon name="arrow" size={16} /></a>}
            <a className="lm-btn lm-btn-ghost" href={NAVER_MAP_URL} target="_blank" rel="noopener noreferrer">네이버 지도로 연남동 보기</a>
            <a className="lm-btn lm-btn-ghost" href={KAKAO_MAP_URL} target="_blank" rel="noopener noreferrer">카카오맵</a>
          </div>
        </div>
        <AreaMap />
      </div>
      <ul className="lm-transit" aria-label="교통">
        {TRANSIT.map((item, i) => <li key={item.label} data-reveal style={delay(i)}>
          <span><Icon name={i === 0 ? "train" : "plane"} size={18} />{item.label}</span><strong>{item.value}</strong><small>{item.note}</small>
        </li>)}
      </ul>
      <ol className="lm-hood" aria-label="걸어서 만나는 동네">
        {NEIGHBORHOOD.map((place, i) => <li key={place.key} data-reveal style={delay(i)}>
          <span>{String(i + 1).padStart(2, "0")}</span><h3>{place.title}</h3><p>{place.body}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}

// 06 — 이용 안내. pay: 카드 결제를 받는 상태인지 (요금·환불 규정·결제 키가 모두 준비됨)
export function Guide({ config, pay = false }: { config: StayConfig; pay?: boolean }) {
  const rules = config.rules.split("\n").map(line => line.trim()).filter(Boolean);
  const items: { q: string; a: ReactNode }[] = [
    { q: "예약은 어떻게 진행되나요?", a: pay
      ? <>객실과 날짜를 고르고 예약자 정보를 적은 뒤 카드로 결제하면 바로 예약이 확정됩니다. 결제는 블랜드픽과 같은 토스페이먼츠 결제창에서 진행되고, 확정 문자를 보내드립니다. 요금이 아직 정해지지 않은 날짜는 결제 없이 신청만 받고 일정 확인 후 안내드립니다.</>
      : <>객실과 날짜를 고르고 예약을 신청하면, 일정을 확인한 뒤 확정 여부와 결제 방법을 문자로 안내드립니다. 신청 단계에서는 결제하지 않습니다.</> },
    { q: "몇 명까지 머물 수 있나요?", a: <>{ROOM_KEYS.map((key, i) => <span key={key}>{i > 0 && ", "}{ROOMS[key].name}은 <b>{config.rooms[key].guests}인</b></span>)}까지 머물 수 있습니다. 기준 인원이 곧 최대 인원이며, 인원 추가는 받지 않습니다.</> },
    { q: "체크인·체크아웃은 몇 시인가요?", a: config.checkInTime || config.checkOutTime
      ? <>체크인 <b>{config.checkInTime || "별도 안내"}</b> · 체크아웃 <b>{config.checkOutTime || "별도 안내"}</b> 입니다.</>
      : <>숙소 공식 안내 기준으로 체크인은 <b>{STAY_STANDARD_HOURS.checkIn} 이후</b>, 체크아웃은 <b>{STAY_STANDARD_HOURS.checkOut}까지</b>입니다. 예약에 적용되는 시간과 입실 방법은 예약 안내를 확인해 주세요.</> },
    pay
      ? { q: "예약을 취소하고 싶어요.", a: <><a href="#lookup">예약 조회</a>에서 취소를 요청해 주세요. 결제할 때 동의하신 취소·환불 규정에 따라 환불 금액을 확인한 뒤 처리해 드립니다.</> }
      : { q: "신청을 취소하고 싶어요.", a: <>확정 전 신청은 <a href="#lookup">예약 조회</a>에서 바로 취소할 수 있습니다. 이미 확정된 예약은 조회 화면에서 취소 요청을 남기면 확인 후 연락드립니다.</> },
    ...(pay && config.refundTerms ? [{ q: "취소·환불 규정이 궁금해요.", a: <p className="lm-pre">{config.refundTerms}</p> }] : []),
    { q: "머무는 동안 지켜 주세요", a: <ul className="lm-rules">{(rules.length ? rules : STAY_HOUSE_RULES).map(rule => <li key={rule}>{rule}</li>)}</ul> },
    { q: "머무는 동안 도움이 필요하면요?", a: <>{HOSTING} 블랜드픽 <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">카카오 상담</a>으로 LIMEN 문의라고 말씀해 주시면 빠르게 도와드립니다.</> },
  ];
  return <section className="lm-section lm-guide" id="guide" aria-labelledby="lm-guide-title">
    <div className="lm-wrap lm-guide-grid">
      <div className="lm-head">
        <Label no="06">GUIDE</Label>
        <h2 className="lm-h2" id="lm-guide-title" data-reveal>머물기 전에<br />알아 둘 것들</h2>
        <a className="lm-text-link" href={KAKAO_URL} target="_blank" rel="noopener noreferrer" data-reveal><Icon name="chat" size={17} />카카오로 문의하기</a>
      </div>
      <div className="lm-faq">
        {items.map((item, i) => <details key={item.q} data-reveal style={delay(i)} open={i === 0}>
          <summary><span>{String(i + 1).padStart(2, "0")}</span>{item.q}<i aria-hidden="true" /></summary>
          <div className="lm-faq-body"><div>{item.a}</div></div>
        </details>)}
      </div>
    </div>
  </section>;
}

// 맺음 — 브랜드 스토리
export function Closing() {
  return <section className="lm-closing" aria-label="LIMEN 브랜드 스토리">
    <div className="lm-wrap lm-closing-grid">
      <figure className="lm-door lm-closing-door" data-reveal="door"><img src={CLOSING_PHOTO.photo.src} srcSet={srcSet(CLOSING_PHOTO.photo)} sizes={DOOR_SIZES} alt={CLOSING_PHOTO.alt} width={952} height={1269} loading="lazy" decoding="async" data-parallax="-0.05" /></figure>
      <div className="lm-closing-copy">
        <p className="lm-label" data-reveal><b>—</b><span>LIMEN · {CLOSING.title}</span></p>
        <h2 data-reveal>{CLOSING.lines.map(line => <span key={line}>{line}</span>)}</h2>
        <p className="lm-closing-vision" data-reveal>{CLOSING.vision}</p>
        <a className="lm-btn lm-btn-light lm-btn-lg" href="#reserve" data-reveal>예약 가능한 날짜 보기<Icon name="arrow" size={18} /></a>
      </div>
    </div>
    <div className="lm-wrap lm-closing-foot">
      <p className="lm-closing-sign" data-reveal><Mark size={30} /><b>{BRAND.name}</b><span>{BRAND.tagline}</span><span>{BRAND.taglineKo.join(" ")}</span></p>
      <p className="lm-closing-by" data-reveal>블랜드픽에서 예약을 받는 숙소입니다. <Link href="/">블랜드픽 둘러보기 ↗</Link></p>
    </div>
  </section>;
}
