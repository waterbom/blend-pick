import { StayFees, StayRate } from './Availability';

const chat = 'http://pf.kakao.com/_VyING/chat';
const map = 'https://map.naver.com/p/search/%EB%8B%A8%EA%B6%81%EA%B3%B0%ED%83%95';
const seasons = [
  { name: '봄', en: 'SPRING', photo: 2, width: 1224, height: 1240, title: '새잎이 돋는 정원,\n함께 시작하는 봄.', copy: '한옥의 처마와 연둣빛 정원 사이로,\n친구·가족과 봄날의 한 장을 남겨보세요.' },
  { name: '여름', en: 'SUMMER', photo: 3, width: 1224, height: 1278, title: '장미와 초록 사이,\n여름을 가득 담아.', copy: '짙어진 정원에서 웃고, 함께 식사하며\n반가운 사람들과 여름의 하루를 보내세요.' },
  { name: '가을', en: 'AUTUMN', photo: 4, width: 1224, height: 1218, title: '물드는 한옥 풍경,\n우리의 오늘도 한 장.', copy: '단풍이 더해진 한옥을 배경으로,\n가족사진도 우정 사진도 계절의 색으로.' },
  { name: '겨울', en: 'WINTER', photo: 5, width: 1224, height: 1292, title: '눈 내린 한옥,\n오래 기억될 하루.', copy: '하얀 정원과 고요한 처마 아래,\n겨울에만 만날 수 있는 단궁을 담아보세요.' },
];
const rooms = [
  [7, '침실', '침대와 화장대가 놓인 단궁 침실'],
  [8, '거실', '소파와 테이블이 놓인 단궁 거실'],
  [9, '주방', '싱크대와 조리 공간이 있는 단궁 주방'],
  [11, '욕실', '세면대와 거울이 있는 단궁 욕실'],
  [12, '다이닝', '단궁 식사 공간과 테이블'],
  [10, '실내 공간', '넓은 바닥이 보이는 단궁 실내 공간'],
  [13, '복도', '객실을 이어주는 단궁 실내 복도'],
  [14, '실내 분위기', '조명이 켜진 단궁 식사 공간'],
] as const;
const photoPath = (photo: number) => `/hotel/dangung/photo-${String(photo).padStart(2, '0')}.jpg`;

function Photo({ photo, alt, label, className = '' }: { photo: number; alt: string; label?: string; className?: string }) {
  return <button type="button" className={`photo-button dgs-photo ${className}`} data-photo={photo} aria-label={`${label || alt} 사진 크게 보기`}>
    <img src={photoPath(photo)} alt={alt} loading="lazy" decoding="async" width={1536} height={1024}/>
    {label && <span>{label} <span aria-hidden="true">↗</span></span>}
  </button>;
}

export function DangungHero() {
  return <>
    <header className="dgs-header"><a className="brand" href="/">BLEND PICK</a><span>단궁 · 한옥 독채</span><a href="/hotel/dangung/result">내 예약 확인 ↗</a></header>
    <section className="hero dgs-hero" aria-labelledby="dangung-title">
      <img src={photoPath(1)} alt="잔디 정원에서 바라본 단궁 한옥 전경" width={1536} height={1024} fetchPriority="high" decoding="async"/>
      <div className="dgs-hero-inner"><div className="dgs-hero-copy">
        <span className="dgs-kicker">DANGUNG × BLEND PICK</span>
        <h1 id="dangung-title">한옥과 잔디 정원에서,<br/>함께 쉬는 하루.</h1>
        <p>가족·친구와 함께 머무는 단궁 독채</p>
        <div className="dgs-hero-facts"><span>기준 <b>6인</b> / 최대 <b>16인</b></span><span>체크인 <b>15:00</b> / 아웃 <b>11:00</b></span></div>
      </div><button className="dgs-photo-open" type="button" data-photo="hero">전경 크게 보기 ↗</button></div>
    </section>
    <div className="dgs-rate-bar" id="stay-rate">
      <StayRate/>
      <StayFees compact/>
      <div className="dgs-rate-action"><a className="booking-primary" href="#booking">날짜·총요금 확인 ↓</a><span>날짜·인원 선택 후 결제금액 확인</span></div>
    </div>
  </>;
}

export function DangungStory() {
  return <div className="dgs-wrap">
    <section className="dgs-section four-seasons" id="four-seasons" aria-labelledby="dgs-seasons-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">FOUR SEASONS</span><h2 id="dgs-seasons-title">어느 계절에 함께할까요?</h2></div><p>사계절마다 달라지는, 같은 자리의 풍경.</p></div>
      <div className="season-grid cinema" id="season-stage">{seasons.map((season, index) => <figure className={`season-frame ${index===0?'active':''}`} inert={index!==0} aria-hidden={index!==0} data-season={index} key={season.name}>
        <button className="photo-button" data-photo={season.photo} type="button" aria-label={`단궁의 ${season.name} 풍경 전체 보기`}><img src={photoPath(season.photo)} alt={`단궁의 ${season.name} 풍경`} width={season.width} height={season.height} loading="lazy" decoding="async"/></button>
        <figcaption><span className="season-en">{season.en} / DANGUNG</span><b>{season.name}</b><h3>{season.title}</h3><p>{season.copy}</p><a href="#booking" className="dgs-text-link">이 계절에 머물기 ↓</a></figcaption>
      </figure>)}</div>
      <div className="season-controls"><div className="season-picks" aria-label="계절 선택">{seasons.map((season, index) => <button type="button" data-pick={index} aria-pressed="false" key={season.name}>{season.name}</button>)}</div><button type="button" id="season-play" aria-controls="season-stage">Ⅱ 일시정지</button><button type="button" id="season-all">네 계절 함께 보기</button></div>
      <p id="season-status" role="status" aria-live="polite">계절 사진 준비 중</p>
    </section>

    <section className="dgs-section" id="highlights" aria-labelledby="dgs-day-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">A DAY AT DANGUNG</span><h2 id="dgs-day-title">서두르지 않아도 좋은 하루.</h2></div><p>멀리 떠나지 않고, 한 공간에서 함께.</p></div>
      <div className="dgs-day-grid">
        <article><Photo photo={6} alt="단궁의 넓은 잔디 정원과 한옥" label="정원"/><span className="dgs-kicker">01 / WALK</span><h3>정원을 함께 걷고</h3><p>초록 풍경과 한옥을 배경으로, 가볍게 산책하고 사진을 남겨보세요.</p></article>
        <article><Photo photo={17} alt="한옥 처마 아래 의자가 놓인 데크" label="처마 아래 데크"/><span className="dgs-kicker">02 / REST</span><h3>처마 아래에서 쉬고</h3><p>친구와 이야기를 나누고 가족과 쉬어가는, 여유로운 한옥의 시간.</p></article>
        <article><Photo photo={18} alt="정원에서 바라본 한옥 외관" label="한옥 전경"/><span className="dgs-kicker">03 / STAY</span><h3>독채에서 함께 머물고</h3><p>기준 6인, 최대 16인. 모처럼 모인 사람들이 한 공간에서 보내는 하루.</p></article>
      </div>
    </section>

    <section className="dgs-section rooms" id="rooms" aria-labelledby="rooms-heading">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">ROOM & CARE</span><h2 id="rooms-heading">머무는 공간도, 편안하게.</h2></div><p>침실부터 주방까지, 사진을 눌러 자세히 보세요.</p></div>
      <ul className="dgs-care"><li>대리석 리모델링 완료</li><li>침구류는 매일 세탁</li><li>단궁 직원이 직접 청소</li></ul>
      <div className="room-gallery-head"><p><b>객실 사진 8장</b><span>옆으로 넘겨보세요</span></p><div className="room-gallery-controls"><button id="rooms-prev" type="button" aria-label="이전 객실 사진 보기" aria-controls="room-gallery">←</button><button id="rooms-next" type="button" aria-label="다음 객실 사진 보기" aria-controls="room-gallery">→</button></div></div>
      <div className="room-gallery" id="room-gallery" role="region" aria-label="단궁 객실 사진 8장" tabIndex={0}>{rooms.map(([photo, label, alt]) => <Photo photo={photo} label={label} alt={alt} className="room-thumb" key={photo}/>)}</div>
      <div className="dgs-room-help"><p>인원에 맞는 침실·침구 구성이 궁금하신가요?</p><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">객실 구성 상담 ↗</a></div>
    </section>

    <section className="dgs-section" id="food" aria-labelledby="dgs-food-title">
      <div className="dgs-section-heading"><div><span className="dgs-kicker">TABLE & EXTRAS</span><h2 id="dgs-food-title">함께 먹는 시간까지 즐겁게.</h2></div><p>가까운 식사, 정원 곁 바비큐, 커피 한 잔.</p></div>
      <div className="dgs-food-grid">
        <article><Photo photo={15} alt="단궁곰탕 간판이 보이는 한옥 외관" label="바로 옆 단궁곰탕"/><h3>곰탕·수육·다양한 한식</h3><p>곰탕은 포장해서 편하게. 숙박객 <strong>20% 할인</strong> 혜택도 함께 확인하세요.</p><a className="dgs-text-link" href={map} target="_blank" rel="noopener noreferrer">단궁곰탕 지도 ↗</a><p className="dgs-small">적용 메뉴·포장 시간·주문 마감은 매장 확인</p></article>
        <article id="bbq"><Photo photo={16} alt="정원 옆 나무 테이블과 그릴이 있는 바비큐장" label="정원 곁 바비큐"/><h3>직접 굽고 나누는 저녁</h3><p>어닝 가림막으로 우천 시에도 이용 가능. 그릴·집게·토치를 준비합니다.</p><p className="dgs-small">세팅은 유료 옵션 · 숯·석쇠 제공 범위와 추가 비용, 강풍·악천후 이용 기준은 예약 전 확인</p></article>
      </div>
      <div className="dgs-coffee" id="cafe"><div><span className="dgs-kicker">AFTER YOUR MEAL</span><h3>식사 후, 바로 옆 카페에서.</h3><p>드라마 촬영이 이뤄졌던 공간에서 여행의 여유를 이어가세요.</p></div><div><strong>커피 50% 할인</strong><p>단궁곰탕 이용 영수증 제시<br/><span className="dgs-small">적용 커피 메뉴·이용 기간은 매장 확인</span></p></div></div>
      <details className="dgs-details"><summary>여럿이 함께하는 식사 · 세미뷔페 안내</summary><p>식당 대관 시 세미뷔페 이용과 일부 음식·반찬 지원이 가능합니다. 지원 범위, 수량, 비용은 사전에 협의해 주세요.</p><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">모임 식사 문의 ↗</a></details>
      <div className="dgs-options-summary" id="pricing"><div><span className="dgs-kicker">CHECK YOUR TOTAL</span><h3>추가 비용도 미리 확인하세요.</h3><p>숙박료에 선택한 인원과 옵션을 더합니다.<br/>시설 보증금은 별도로 납부합니다.</p></div><StayFees/></div>
    </section>
  </div>;
}

export function DangungGuide() {
  return <div className="dgs-wrap"><section className="dgs-section dgs-guide" id="stay" aria-labelledby="dgs-guide-title">
    <div className="dgs-section-heading"><div><span className="dgs-kicker">BEFORE YOUR STAY</span><h2 id="dgs-guide-title">머무르기 전, 이것만 확인하세요.</h2></div><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">예약 전 상담 ↗</a></div>
    <dl className="dgs-guide-facts"><div><dt>입실 / 퇴실</dt><dd>15:00 / 11:00</dd></div><div><dt>기준 / 최대 인원</dt><dd>6인 / 16인</dd></div><div><dt>얼리 체크인</dt><dd>불가</dd></div><div><dt>반려동물</dt><dd>동반 불가</dd></div></dl>
    <details className="dgs-details"><summary>찾아오는 길과 주차는 어떻게 확인하나요?</summary><p>숙소 입구와 주차 위치는 방문 전 카카오 상담으로 안내받아 주세요. 아래 지도는 숙소 바로 옆 식당인 단궁곰탕의 위치입니다.</p><div className="dgs-link-row"><a className="dgs-text-link" href={map} target="_blank" rel="noopener noreferrer">단궁곰탕 지도 ↗</a><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">숙소 위치·주차 문의 ↗</a></div></details>
    <details className="dgs-details"><summary>야외 활동이나 소품 반입이 가능한가요?</summary><p>잔디를 훼손하지 않는 범위에서 촬영장비, 휴대용 풀장, 기념일 소품을 가져올 수 있습니다. 물품 대여·제공은 아니며 설치와 철거까지 직접 진행해 주세요. 음악·야외 활동의 허용 시간과 음량은 사전에 협의해 주세요.</p></details>
    <details className="dgs-details dgs-shooting" id="memory"><summary>숙박 외 촬영대관도 궁금하신가요?</summary><p>한옥과 정원에서 남기는 우정 사진, 가족사진, 커플 스냅. 이용 공간·시간·대관료와 촬영 서비스 포함 여부는 별도로 문의해 주세요.</p><div className="dgs-memory-grid"><Photo photo={19} alt="초록 식재와 계단이 있는 단궁 정원" label="정원 풍경"/><Photo photo={20} alt="함께 뛰놀던 정원" label="함께한 순간"/><Photo photo={21} alt="한 걸음도 추억으로" label="추억을 남기는 길"/><Photo photo={22} alt="우리의 하루를 감싼 풍경" label="우리의 하루"/></div><a className="dgs-text-link" href={chat} target="_blank" rel="noopener noreferrer">촬영대관 문의 ↗</a></details>
  </section><div className="dgs-closing"><span>DANGUNG × BLEND PICK</span><p>함께할 날을 골라보세요.</p><a href="#booking" className="dgs-text-link">날짜·총요금 확인 ↑</a></div></div>;
}
