import type { CSSProperties } from 'react';
import DangungGallery from '@/components/dangung/Gallery';
import DangungNotice from '@/components/dangung/Notice';
import RoomSlideshow from '@/components/dangung/RoomSlideshow';
import { getPhoto, photoPath, photoSrcSet } from '@/components/dangung/Photos';
import { dangungBlogPosts, dangungBlogSearch } from '@/lib/dangung-blog-posts';

// 단궁 숙박 페이지의 본문. 디자인 원칙은 '있는 그대로' —
//  · 사진은 받은 그대로 쓴다. 본문에서는 잘라내지 않고 원래 비율로 크게 보여 주고, 기록 사진처럼 짧은 설명만 붙인다.
//  · 한지색 바탕에 먹색 글자, 소나무색과 나무색만 포인트로 쓴다. 꾸밈 효과와 움직임은 넣지 않는다.
//  · 문구는 사진과 운영 안내에서 확인되는 사실만 적는다.
const chat = 'http://pf.kakao.com/_VyING/chat';
const map = 'https://map.naver.com/p/search/%EB%8B%A8%EA%B6%81%EA%B3%B0%ED%83%95';

// 본문 너비에 놓이는 사진 / 화면 폭 절반 / 네 칸으로 나뉜 사진이 차지하는 폭
const WIDE = '(max-width: 980px) 92vw, 760px';
const HALF = '(max-width: 980px) 92vw, 560px';
const QUARTER = '(max-width: 600px) 46vw, (max-width: 980px) 23vw, 300px';

// 원래 비율 그대로의 사진 + 짧은 설명. 누르면 원본을 크게 본다.
function Photo({ id, caption, className = '', sizes = WIDE }: { id: number; caption?: string | false; className?: string; sizes?: string }) {
  const photo = getPhoto(id);
  return <figure className={`dgs-photo ${className}`}>
    <button type="button" data-photo={id} aria-label={`${photo.label} 사진 크게 보기`}>
      <img src={photoPath(id)} srcSet={photoSrcSet(id)} sizes={sizes} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async"/>
    </button>
    {caption !== false && <figcaption>{caption ?? photo.label}</figcaption>}
  </figure>;
}

// 단궁을 이루는 재료 — 받은 사진의 한 부분을 가까이 보여 준다 (x·y: 사진에서 볼 지점, zoom: 확대)
const MATERIALS: { id: number; name: string; note: string; x: number; y: number; zoom: number }[] = [
  { id: 3, name: '기와', note: '하늘로 들린 처마와 기와의 선', x: 78, y: 42, zoom: 1.5 },
  { id: 17, name: '나무', note: '볕이 드는 마루, 나무 기둥과 문살', x: 74, y: 30, zoom: 1.5 },
  { id: 16, name: '돌', note: '정원 한쪽을 두른 돌담', x: 28, y: 22, zoom: 1.7 },
  { id: 6, name: '잔디', note: '한옥 앞 너른 잔디와 바위 하나', x: 30, y: 62, zoom: 1.7 },
];

export function DangungHero() {
  return <>
    <div className="dgs-breadcrumb"><a href="/hotel">숙박·호텔</a><span aria-hidden="true">/</span><span>단궁</span></div>
    <DangungGallery/>
    <div className="dgs-title-row">
      <div>
        <span className="dgs-kicker">DANGUNG · PRIVATE HANOK</span>
        <h1 id="dangung-title">단궁</h1>
        <p>경기 / 양주 <span>독채 한옥 스테이</span></p>
      </div>
      <div className="dgs-title-note">
        <p>한옥의 결, 정원의 사계절.<br/>함께 머물기에 더 좋은 하루.</p>
        <div className="dgs-title-links"><a href="#booking" className="dgs-title-cta">날짜 보고 예약하기 <span aria-hidden="true">→</span></a><a href="/hotel/dangung/result">내 예약 확인 ↗</a></div>
      </div>
    </div>
  </>;
}

export function DangungNavigation() {
  return <nav className="dgs-nav" aria-label="단궁 페이지 바로가기"><div>
    <a href="#stay-story" aria-current="location">스테이 소개</a>
    <a href="#rooms">객실 선택</a>
    <a href="#location">위치·안내</a>
    <a href="#stay">예약 안내</a>
    <a href="#blog">블로그</a>
  </div></nav>;
}

// 화면 폭을 넓게 쓰는 소개 — 풍경, 네 계절, 재료. 예약 영역은 이 아래 본문 옆에 붙는다.
export function DangungIntro() {
  return <section className="dgs-intro" id="stay-story" aria-labelledby="dgs-story-title">
    <div className="dgs-about">
      <div className="dgs-about-copy">
        <span className="dgs-kicker">ABOUT THE STAY</span>
        <h2 id="dgs-story-title" className="dgs-story-title">한옥의 시간이 흐르는 곳,<br/>우리만의 하루가 시작됩니다.</h2>
        <div className="dgs-prose"><p>정원을 따라 시선이 머무는 곳에 단궁이 있습니다. 길게 이어진 처마와 너른 잔디, 계절마다 달라지는 나무의 빛깔. 바쁘게 채우던 하루에서 한 걸음 떨어져, 함께 온 사람들과 천천히 시간을 보내보세요.</p><p>가족이 둘러앉아 식사하고, 친구와 처마 아래에서 이야기를 나누는 저녁. 단궁은 기준 6인부터 최대 16인까지 함께 머물 수 있는 한옥 독채입니다. 익숙한 사람들과 새로운 풍경 속에서 보내는 하루를 준비했습니다.</p></div>
      </div>
      <Photo id={6} className="dgs-about-photo" sizes={WIDE} caption="잔디 정원 — 한옥으로 둘러싸인 마당"/>
    </div>

    <div className="dgs-seasons" id="four-seasons">
      <div className="dgs-band-heading"><span className="dgs-kicker">FOUR SEASONS</span><h3>네 계절, 네 가지 단궁</h3><p>봄, 여름, 가을, 겨울. 계절마다 달라지는 단궁의 모습입니다.</p></div>
      <div className="dgs-season-grid">
        {([['봄', 2, 'SPRING'], ['여름', 3, 'SUMMER'], ['가을', 4, 'AUTUMN'], ['겨울', 5, 'WINTER']] as const).map(([label, id, en]) => <figure key={id} className="dgs-season">
          <button type="button" data-photo={id} aria-label={`${label} 사진 크게 보기`}><img src={photoPath(id)} srcSet={photoSrcSet(id)} sizes={QUARTER} alt={getPhoto(id).alt} width={getPhoto(id).width} height={getPhoto(id).height} loading="lazy" decoding="async"/></button>
          <figcaption><b>{label}</b><span>{en}</span></figcaption>
        </figure>)}
      </div>
    </div>

    <div className="dgs-materials" id="materials">
      <div className="dgs-band-heading"><span className="dgs-kicker">AS IT IS</span><h3>단궁을 이루는 것들</h3><p>기와와 나무, 돌과 잔디. 단궁의 바깥은 이런 것들로 이루어져 있습니다.</p></div>
      <div className="dgs-material-grid">
        {MATERIALS.map(item => <figure key={item.name} className="dgs-material">
          <button type="button" data-photo={item.id} aria-label={`${item.name} — ${getPhoto(item.id).label} 사진 크게 보기`} style={{ '--x': `${item.x}%`, '--y': `${item.y}%`, '--zoom': item.zoom } as CSSProperties}>
            <img src={photoPath(item.id)} srcSet={photoSrcSet(item.id)} sizes="(max-width: 600px) 110vw, 760px" alt={`${item.name} — ${item.note}`} width={getPhoto(item.id).width} height={getPhoto(item.id).height} loading="lazy" decoding="async"/>
          </button>
          <figcaption><b>{item.name}</b><span>{item.note}</span></figcaption>
        </figure>)}
      </div>
    </div>
  </section>;
}

export function DangungStory() {
  return <>
    <section className="dgs-section dgs-story" id="highlights" aria-labelledby="dgs-day-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">A DAY AT DANGUNG</span><h2 id="dgs-day-title">단궁에서의 하루</h2></div></div>
      <div className="dgs-feature-grid">
        <article><Photo id={18} caption="한옥 전경 — 정원에서 바라본 모습"/><span className="dgs-kicker">TOGETHER</span><h3>함께 머무는 한옥</h3><p>따로 흩어지지 않고 한 공간에서. 모처럼 모인 사람들과 독채에서 보내는 하루.</p></article>
        <article><Photo id={17} sizes={HALF} caption="처마 아래 — 마루와 의자"/><span className="dgs-kicker">REST</span><h3>처마 아래의 쉼</h3><p>정원을 바라보며 쉬어가는 자리. 차 한 잔과 함께 느긋한 대화를 나눠보세요.</p></article>
        <article><Photo id={19} sizes={HALF} caption="정원의 길 — 계단과 초록"/><span className="dgs-kicker">GARDEN</span><h3>산책이 되는 정원</h3><p>한옥과 초록을 배경으로 걷고, 머물고, 함께한 날의 사진을 남겨보세요.</p></article>
      </div>
      <div className="dgs-care"><span className="dgs-kicker">THE PEOPLE & CARE</span><h3>다음 머무름을 준비하는 마음</h3><p>대리석 리모델링으로 새롭게 단장한 실내.<br/>침구류는 매일 세탁하고, 단궁 직원이 직접 청소합니다.</p></div>
      <ul className="dgs-amenities" aria-label="단궁 공간과 시설"><li><span aria-hidden="true">01</span>한옥 독채</li><li><span aria-hidden="true">02</span>잔디 정원</li><li><span aria-hidden="true">03</span>주방·다이닝</li><li><span aria-hidden="true">04</span>바비큐 옵션</li></ul>
    </section>

    <section className="dgs-section" id="rooms" aria-labelledby="rooms-heading">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">SELECT ROOM</span><h2 id="rooms-heading">객실 선택</h2></div><span className="dgs-small">한옥 독채 1개 타입</span></div>
      <article className="dgs-room-detail"><RoomSlideshow/><div className="dgs-room-description"><span className="dgs-kicker">PRIVATE HOUSE</span><h3>단궁 독채</h3><p>한옥과 정원, 함께 쉬는 하루.</p><dl><div><dt>이용 인원</dt><dd>기준 6인 / 최대 16인</dd></div><div><dt>체크인 / 체크아웃</dt><dd>15:00 / 11:00</dd></div><div><dt>공간</dt><dd>침실 · 거실 · 주방 · 다이닝 · 욕실</dd></div></dl><a href="#booking" className="dgs-room-select">날짜 선택하고 예약하기 <span aria-hidden="true">→</span></a></div></article>
      <div className="dgs-mini-heading dgs-room-gallery-heading"><h3>객실 자세히 보기</h3><div className="dgs-gallery-arrows"><button id="rooms-prev" type="button" aria-label="이전 객실 사진" aria-controls="room-gallery">←</button><button id="rooms-next" type="button" aria-label="다음 객실 사진" aria-controls="room-gallery">→</button></div></div>
      <div className="dgs-room-gallery" id="room-gallery" role="region" aria-label="단궁 객실 사진" tabIndex={0}>{[8, 9, 11, 12, 10, 13, 14].map(id => <Photo id={id} key={id} sizes="(max-width: 600px) 64vw, 260px"/>)}</div>
      <p className="dgs-small dgs-room-help">인원에 맞는 침실·침구 구성이 궁금하다면 <a href={chat} target="_blank" rel="noopener noreferrer">객실 구성 상담 ↗</a></p>
    </section>

    <section className="dgs-section" id="food" aria-labelledby="dgs-food-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">TABLE & EXPERIENCE</span><h2 id="dgs-food-title">함께 먹고, 오래 머물고</h2></div></div>
      <div className="dgs-food-grid">
        <article><Photo id={15} sizes={HALF} caption="단궁곰탕 — 한옥 외관"/><h3>바로 옆, 단궁곰탕</h3><p>곰탕·수육·다양한 한식을 가까이에서. 곰탕은 포장해서 편하게 즐기고, 숙박객 20% 할인 혜택도 확인하세요.</p><a className="dgs-text-link" href={map} target="_blank" rel="noopener noreferrer">단궁곰탕 지도 ↗</a><small>적용 메뉴·포장 시간·주문 마감은 매장 확인</small></article>
        <article id="bbq"><Photo id={16} sizes={HALF} caption="바비큐 — 돌담 곁 나무 테이블"/><h3>정원 곁 바비큐</h3><p>함께 굽고 나누는 저녁. 어닝 가림막으로 우천 시에도 이용할 수 있으며, 그릴·집게·토치를 준비합니다.</p><a className="dgs-text-link" href="#booking">바비큐 옵션 선택 →</a><small>유료 옵션 · 숯·석쇠 제공 범위와 추가 비용, 강풍·악천후 이용 기준은 예약 전 확인</small></article>
      </div>
      <details className="dgs-details" id="cafe"><summary>식사 후 카페 · 커피 50% 할인 안내</summary><p>바로 옆 카페에서 여유를 이어가세요. 단궁곰탕 이용 영수증을 제시하면 커피 50% 할인 혜택이 있습니다. 적용 메뉴와 이용 기간은 매장에 확인해 주세요.</p></details>
      <details className="dgs-details"><summary>여럿이 함께하는 식사 · 세미뷔페 안내</summary><p>식당 대관 시 세미뷔페 이용과 일부 음식·반찬 지원이 가능합니다. 지원 범위, 수량, 비용은 사전에 협의해 주세요.</p><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">모임 식사 문의 ↗</a></details>
    </section>
  </>;
}

export function DangungGuide() {
  return <>
    <section className="dgs-section" id="location" aria-labelledby="dgs-location-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">EXPLORE THE AREA</span><h2 id="dgs-location-title">위치와 주변 안내</h2></div></div>
      <div className="dgs-location"><div><span className="dgs-kicker">YANGJU, GYEONGGI</span><h3>경기도 양주,<br/>한옥과 정원이 만나는 곳.</h3><p>경기 양주시 백석읍 권율로 875</p><small>단궁곰탕 기준 주소입니다. 숙소 입구와 주차 위치는 방문 전 별도로 안내받아 주세요.</small></div><a href={map} target="_blank" rel="noopener noreferrer" className="dgs-map-link"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M25 13c0 7-9 15-9 15S7 20 7 13a9 9 0 1 1 18 0Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="16" cy="13" r="3" stroke="currentColor" strokeWidth="1.4"/></svg><strong>지도에서 위치 보기</strong><span>네이버 지도 ↗</span></a></div>
      <div className="dgs-location-foot"><p>숙소 입구 · 주차 · 도착 안내</p><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">카카오로 문의하기 ↗</a></div>
    </section>

    <section className="dgs-section" id="stay" aria-labelledby="dgs-notice-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">NOTICE</span><h2 id="dgs-notice-title">예약 전 안내</h2></div></div>
      <dl className="dgs-stay-facts"><div><dt>입실 / 퇴실</dt><dd>15:00 / 11:00</dd></div><div><dt>기준 / 최대 인원</dt><dd>6인 / 16인</dd></div><div><dt>얼리 체크인</dt><dd>불가</dd></div><div><dt>반려동물</dt><dd>동반 불가</dd></div></dl>
      <details className="dgs-details"><summary>야외 활동과 소품 반입 안내</summary><p>잔디를 훼손하지 않는 범위에서 촬영장비, 휴대용 풀장, 기념일 소품을 가져올 수 있습니다. 물품 대여·제공은 아니며 설치와 철거까지 직접 진행해 주세요. 음악·야외 활동의 허용 시간과 음량은 사전에 협의해 주세요.</p></details>
      <DangungNotice/>
      <details className="dgs-details" id="memory"><summary>숙박 외 촬영대관 안내</summary><p>한옥과 정원에서 남기는 우정 사진, 가족사진, 커플 스냅. 이용 공간·시간·대관료와 촬영 서비스 포함 여부는 별도로 문의해 주세요.</p><div className="dgs-memory-grid">{[20, 21, 22].map(id => <Photo id={id} key={id} sizes="(max-width: 600px) 30vw, 250px" caption={false}/>)}</div><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">촬영대관 문의 ↗</a></details>
    </section>

    <section className="dgs-section dgs-blog" id="blog" aria-labelledby="dgs-blog-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">DANGUNG JOURNAL</span><h2 id="dgs-blog-title">블로그로 미리 만나는 단궁</h2></div><a className="dgs-text-link" href={dangungBlogSearch.href} target="_blank" rel="noopener noreferrer">더 보기 ↗</a></div>
      <p className="dgs-blog-intro">검색으로 찾은 단궁의 한옥과 정원 이야기.</p>
      <ol className="dgs-blog-list">{dangungBlogPosts.map((post, index) => <li key={post.href}><a href={post.href} target="_blank" rel="noopener noreferrer"><span className="dgs-blog-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><span className="dgs-blog-topic">{post.topic} · 카페 방문기</span><h3>{post.title}</h3><p>{post.description}</p><small>{post.author}<span aria-hidden="true"> · </span><time dateTime={post.publishedAt}>{post.publishedAt.replaceAll('-', '.')}</time></small></div><span className="dgs-blog-arrow" aria-hidden="true">↗</span></a></li>)}</ol>
      <p className="dgs-small dgs-blog-note">카페·정원 방문 기록으로, 현재 숙박 시설·운영 안내와 차이가 있을 수 있습니다. 검색 결과 확인일 {dangungBlogSearch.checkedAt.replaceAll('-', '.')} · 원문에서 자세히 보기</p>
    </section>
  </>;
}

// 맺음 — 정원과 하늘 사진 한 장과 예약으로 가는 한 줄
export function DangungClosing() {
  return <div className="dgs-closing">
    <Photo id={22} className="dgs-closing-photo" sizes={WIDE} caption="우리의 하루 — 푸른 하늘 아래 한옥과 잔디 정원"/>
    <div className="dgs-closing-copy"><span className="dgs-kicker">DANGUNG × BLEND PICK</span><p>함께할 날을 골라보세요.</p><a href="#booking" className="dgs-text-link">단궁에서 머물기 →</a></div>
  </div>;
}
