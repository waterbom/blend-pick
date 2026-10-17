import DangungGallery from '@/components/dangung/Gallery';
import DangungNotice from '@/components/dangung/Notice';
import RoomSlideshow from '@/components/dangung/RoomSlideshow';
import { getPhoto, photoPath } from '@/components/dangung/Photos';
import { dangungBlogPosts, dangungBlogSearch } from '@/lib/dangung-blog-posts';

const chat = 'http://pf.kakao.com/_VyING/chat';
const map = 'https://map.naver.com/p/search/%EB%8B%A8%EA%B6%81%EA%B3%B0%ED%83%95';

function Photo({ id, label, className = '' }: { id: number; label?: string; className?: string }) {
  const photo = getPhoto(id);
  return <button type="button" className={`dgs-photo ${className}`} data-photo={id} aria-label={`${photo.label} 사진 크게 보기`}>
    <img src={photoPath(id)} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async"/>
    {label && <span>{label}<span aria-hidden="true">↗</span></span>}
  </button>;
}

export function DangungHero() {
  return <>
    <div className="dgs-breadcrumb"><a href="/hotel">숙박·호텔</a><span aria-hidden="true">/</span><span>단궁</span></div>
    <DangungGallery/>
    <div className="dgs-title-row">
      <div><span className="dgs-kicker">DANGUNG · PRIVATE HANOK</span><h1 id="dangung-title">단궁</h1><p>경기 / 양주 <span>독채 한옥 스테이</span></p></div>
      <div className="dgs-title-note"><p>한옥의 결, 정원의 사계절.<br/>함께 머물기에 더 좋은 하루.</p><a href="/hotel/dangung/result">내 예약 확인 ↗</a></div>
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

export function DangungStory() {
  return <>
    <section className="dgs-section dgs-story" id="stay-story" aria-labelledby="dgs-story-title">
      <span className="dgs-kicker">ABOUT THE STAY</span>
      <h2 id="dgs-story-title" className="dgs-story-title">한옥의 시간이 흐르는 곳,<br/>우리만의 하루가 시작됩니다.</h2>
      <Photo id={6} className="dgs-story-photo"/>
      <div className="dgs-prose"><p>정원을 따라 시선이 머무는 곳에 단궁이 있습니다. 길게 이어진 처마와 너른 잔디, 계절마다 달라지는 나무의 빛깔. 바쁘게 채우던 하루에서 한 걸음 떨어져, 함께 온 사람들과 천천히 시간을 보내보세요.</p><p>가족이 둘러앉아 식사하고, 친구와 처마 아래에서 이야기를 나누는 저녁. 단궁은 기준 6인부터 최대 16인까지 함께 머물 수 있는 한옥 독채입니다. 익숙한 사람들과 새로운 풍경 속에서 보내는 하루를 준비했습니다.</p></div>
      <div className="dgs-seasons" id="four-seasons"><div className="dgs-mini-heading"><h3>네 계절, 네 가지 단궁</h3><span>FOUR SEASONS</span></div><div className="dgs-season-grid">
        {[['봄', 2, 'SPRING'], ['여름', 3, 'SUMMER'], ['가을', 4, 'AUTUMN'], ['겨울', 5, 'WINTER']].map(([label, id, en]) => <figure key={id}><Photo id={Number(id)}/><figcaption><b>{label}</b><span>{en}</span></figcaption></figure>)}
      </div></div>
      <div className="dgs-features" id="highlights"><div className="dgs-mini-heading"><h3>단궁에서의 하루</h3><span>KEY FEATURES</span></div><div className="dgs-feature-grid">
        <article><Photo id={17}/><span className="dgs-kicker">REST</span><h4>처마 아래의 쉼</h4><p>정원을 바라보며 쉬어가는 자리. 차 한 잔과 함께 느긋한 대화를 나눠보세요.</p></article>
        <article><Photo id={18}/><span className="dgs-kicker">TOGETHER</span><h4>함께 머무는 한옥</h4><p>따로 흩어지지 않고 한 공간에서. 모처럼 모인 사람들과 독채에서 보내는 하루.</p></article>
        <article><Photo id={19}/><span className="dgs-kicker">GARDEN</span><h4>산책이 되는 정원</h4><p>한옥과 초록을 배경으로 걷고, 머물고, 함께한 날의 사진을 남겨보세요.</p></article>
      </div></div>
      <div className="dgs-care"><span className="dgs-kicker">THE PEOPLE & CARE</span><h3>다음 머무름을 준비하는 마음</h3><p>대리석 리모델링으로 새롭게 단장한 실내.<br/>침구류는 매일 세탁하고, 단궁 직원이 직접 청소합니다.</p></div>
      <ul className="dgs-amenities" aria-label="단궁 공간과 시설"><li><span aria-hidden="true">01</span>한옥 독채</li><li><span aria-hidden="true">02</span>잔디 정원</li><li><span aria-hidden="true">03</span>주방·다이닝</li><li><span aria-hidden="true">04</span>바비큐 옵션</li></ul>
    </section>

    <section className="dgs-section" id="rooms" aria-labelledby="rooms-heading">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">SELECT ROOM</span><h2 id="rooms-heading">객실 선택</h2></div><span className="dgs-small">한옥 독채 1개 타입</span></div>
      <article className="dgs-room-detail"><RoomSlideshow/><div className="dgs-room-description"><span className="dgs-kicker">PRIVATE HOUSE</span><h3>단궁 독채</h3><p>한옥과 정원, 함께 쉬는 하루.</p><dl><div><dt>이용 인원</dt><dd>기준 6인 / 최대 16인</dd></div><div><dt>체크인 / 체크아웃</dt><dd>15:00 / 11:00</dd></div><div><dt>공간</dt><dd>침실 · 거실 · 주방 · 다이닝 · 욕실</dd></div></dl><a href="#booking" className="dgs-room-select">날짜 선택하고 예약하기 <span aria-hidden="true">→</span></a></div></article>
      <div className="dgs-mini-heading dgs-room-gallery-heading"><h3>객실 자세히 보기</h3><div className="dgs-gallery-arrows"><button id="rooms-prev" type="button" aria-label="이전 객실 사진" aria-controls="room-gallery">←</button><button id="rooms-next" type="button" aria-label="다음 객실 사진" aria-controls="room-gallery">→</button></div></div>
      <div className="dgs-room-gallery" id="room-gallery" role="region" aria-label="단궁 객실 사진" tabIndex={0}>{[8, 9, 11, 12, 10, 13, 14].map(id => <Photo id={id} label={getPhoto(id).label} key={id}/>)}</div>
      <p className="dgs-small dgs-room-help">인원에 맞는 침실·침구 구성이 궁금하다면 <a href={chat} target="_blank" rel="noopener noreferrer">객실 구성 상담 ↗</a></p>
    </section>

    <section className="dgs-section" id="food" aria-labelledby="dgs-food-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">TABLE & EXPERIENCE</span><h2 id="dgs-food-title">함께 먹고, 오래 머물고</h2></div></div>
      <div className="dgs-food-grid">
        <article><Photo id={15}/><h3>바로 옆, 단궁곰탕</h3><p>곰탕·수육·다양한 한식을 가까이에서. 곰탕은 포장해서 편하게 즐기고, 숙박객 20% 할인 혜택도 확인하세요.</p><a className="dgs-text-link" href={map} target="_blank" rel="noopener noreferrer">단궁곰탕 지도 ↗</a><small>적용 메뉴·포장 시간·주문 마감은 매장 확인</small></article>
        <article id="bbq"><Photo id={16}/><h3>정원 곁 바비큐</h3><p>함께 굽고 나누는 저녁. 어닝 가림막으로 우천 시에도 이용할 수 있으며, 그릴·집게·토치를 준비합니다.</p><a className="dgs-text-link" href="#booking">바비큐 옵션 선택 →</a><small>유료 옵션 · 숯·석쇠 제공 범위와 추가 비용, 강풍·악천후 이용 기준은 예약 전 확인</small></article>
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
      <details className="dgs-details" id="memory"><summary>숙박 외 촬영대관 안내</summary><p>한옥과 정원에서 남기는 우정 사진, 가족사진, 커플 스냅. 이용 공간·시간·대관료와 촬영 서비스 포함 여부는 별도로 문의해 주세요.</p><div className="dgs-memory-grid">{[20,21,22].map(id => <Photo id={id} key={id}/>)}</div><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">촬영대관 문의 ↗</a></details>
    </section>

    <section className="dgs-section dgs-blog" id="blog" aria-labelledby="dgs-blog-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">DANGUNG JOURNAL</span><h2 id="dgs-blog-title">블로그로 미리 만나는 단궁</h2></div><a className="dgs-text-link" href={dangungBlogSearch.href} target="_blank" rel="noopener noreferrer">더 보기 ↗</a></div>
      <p className="dgs-blog-intro">검색으로 찾은 단궁의 한옥과 정원 이야기.</p>
      <ol className="dgs-blog-list">{dangungBlogPosts.map((post, index) => <li key={post.href}><a href={post.href} target="_blank" rel="noopener noreferrer"><span className="dgs-blog-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><span className="dgs-blog-topic">{post.topic} · 카페 방문기</span><h3>{post.title}</h3><p>{post.description}</p><small>{post.author}<span aria-hidden="true"> · </span><time dateTime={post.publishedAt}>{post.publishedAt.replaceAll('-', '.')}</time></small></div><span className="dgs-blog-arrow" aria-hidden="true">↗</span></a></li>)}</ol>
      <p className="dgs-small dgs-blog-note">카페·정원 방문 기록으로, 현재 숙박 시설·운영 안내와 차이가 있을 수 있습니다. 검색 결과 확인일 {dangungBlogSearch.checkedAt.replaceAll('-', '.')} · 원문에서 자세히 보기</p>
    </section>
  </>;
}
