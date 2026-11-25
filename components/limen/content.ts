// LIMEN(리멘 · 연남동) 페이지 콘텐츠 — 사진·문구는 여기만 고치면 화면에 반영된다.
//
// ★ 브랜드 문구(철학·가치·스토리)는 숙소가 보낸 브랜드 문서(2026-11)의 문장을 그대로 옮겼다. 뜻을 바꾸지 않는다.
// ★ 사진을 추가할 때
//   1) public/hotel/limen/ 에 큰 사진(name.webp, 세로 952×1269 권장)과 작은 사진(name-sm.webp, 가로 520px)을 넣고
//   2) 아래 SPACES 에 항목을 추가하거나 기존 항목의 photo 를 바꾼다.
// 공간 설명은 사진에서 확인되는 사실만 적는다. 요금·주소·입실 시간처럼 운영자가 정하는 값은
// 관리자 화면(/admin/limen)에서 입력하며, 주소·시간이 비어 있으면 주소는 예약 안내로, 입퇴실 시간은 숙소 공식 사이트의 기본 안내로 구분해 표시한다.

export const LIMEN_PATH = "/hotel/limen";
export const LIMEN_URL = "https://shop.blendpunch.com/hotel/limen";
const photo = (name: string) => ({ src: `/hotel/limen/${name}.webp`, small: `/hotel/limen/${name}-sm.webp` });
// 화면에 그려지는 크기에 맞는 사진만 내려받게 한다 — 작은 사진(520w)과 큰 사진(952w) 중 브라우저가 고른다.
// sizes: 문 모양 틀이 화면에서 차지하는 너비
export const DOOR_SIZES = "(max-width: 959px) 78vw, 30vw";
export const srcSet = (p: { src: string; small: string }) => `${p.small} 520w, ${p.src} 952w`;

export const BRAND = {
  name: "LIMEN",
  nameKo: "리멘",
  tagline: "Beyond the Threshold, Into Stillness.",
  taglineKo: ["경계를 넘어,", "고요함 속으로."],
  place: "YEONNAM-DONG, SEOUL",
  // 브랜드를 정의하는 한 문장
  definition: "LIMEN은 도시의 활기와 개인의 고요함 사이에 존재하는 하나의 경계입니다.",
  naming: {
    title: "경계, 문턱, 새로운 시작",
    body: ["LIMEN은 라틴어로 ‘문턱’을 의미합니다.", "바깥세상과 안쪽 세계를 나누는 경계이자, 새로운 시작을 상징하는 단어입니다."],
  },
};

// 문을 지나는 장면 — 스크롤에 따라 문이 열리며 차례로 떠오르는 문장 (브랜드 스토리)
export const PASSAGE = ["도시의 소음이 멀어지는 경계.", "하나의 문을 지나면", "또 다른 세계가 시작됩니다."];

// LIMEN을 시작한 이유
export const STORY = {
  lead: "LIMEN은 여섯 명의 가족의 마음이 모여 시작된 새로운 출발입니다.",
  body: [
    "더 나은 내일을 만들고자 하는 바람과 소중한 사람들을 위한 마음에서 출발한 이 공간은, 단순한 숙소 이상의 의미를 지닙니다.",
    "서울에서 가장 활기차고 화려한 지역 중 하나인 홍대와 연남동. 우리는 그 중심에서 오히려 정반대의 경험을 선사하고 싶었습니다.",
    "마치 이상한 나라의 앨리스가 새로운 세계로 들어가듯, LIMEN의 문을 넘는 순간 일상의 속도에서 벗어나 자신만의 시간과 마주할 수 있기를 바랍니다.",
    "우리가 새로운 시작을 위해 이 공간을 만들었듯, 이곳을 찾는 사람들에게도 잠시 쉬어가고 다시 나아갈 수 있는 공간이 되기를 바랍니다.",
  ],
  quote: "바깥의 소음과 분주함에서 벗어나, 문 하나를 경계로 전혀 다른 분위기가 펼쳐지는 곳.",
};

// 우리가 지향하는 가치
export const VALUES: { en: string; ko: string; body: string[] }[] = [
  { en: "Threshold", ko: "경계와 전환", body: ["하나의 문을 사이에 두고 도시의 활기에서 개인의 고요함으로 전환되는 경험.", "LIMEN의 모든 공간은 이러한 경계를 중심으로 설계됩니다."] },
  { en: "Privacy", ko: "온전한 사생활", body: ["타인의 시선이나 불필요한 간섭에서 벗어나 오롯이 자신에게 집중할 수 있는 공간.", "프라이버시는 LIMEN이 추구하는 핵심 가치입니다."] },
  { en: "Stillness", ko: "고요함과 휴식", body: ["진정한 휴식은 화려함보다 차분함에서 시작된다고 믿습니다.", "시각적 자극을 줄이고 따뜻한 소재와 절제된 디자인으로 편안함을 전달합니다."] },
  { en: "Sincerity", ko: "진정성과 배려", body: ["가족의 새로운 출발에서 시작된 브랜드인 만큼, 머무는 사람에게도 진심 어린 배려를 전합니다.", "과시적인 서비스보다 세심하게 준비된 공간을 지향합니다."] },
];

// 맺음 — 브랜드 스토리와 앞으로의 방향
export const CLOSING = {
  title: "Beyond the Ordinary",
  lines: ["여섯 사람의 새로운 시작에서 탄생한 이 공간이,", "누군가에게는 가장 따뜻하고 고요한 쉼이 되기를 바랍니다."],
  vision: "도시 안에 존재하지만, 도시와는 다른 시간을 경험하는 곳.",
};
// 운영 방식 (이용 안내에 싣는다)
export const HOSTING = "과도한 개입이나 형식적인 환대보다, 머무는 분의 사생활을 존중하면서 필요한 순간에는 세심하게 응답하는 방식을 추구합니다.";

// 객실 — 요금·최대 인원은 관리자 설정(config.rooms)에서 읽는다. 여기는 이름과 소개, 대표 사진만.
export type RoomKey = "one" | "two";
export const ROOM_KEYS: RoomKey[] = ["one", "two"];
export const ROOMS: Record<RoomKey, { name: string; en: string; summary: string; photo: { src: string; small: string }; alt: string }> = {
  one: { name: "원룸", en: "ONE ROOM", summary: "낮은 가벽이 나누는 방 하나. 침대와 주방, 창가의 식탁까지.", photo: photo("one-living"), alt: "낮은 가벽과 창이 있는 LIMEN 원룸" },
  two: { name: "투룸", en: "TWO ROOM", summary: "침실 둘, 주방과 세탁실까지 한 팀이 온전히.", photo: photo("bedroom"), alt: "오크 패널 벽과 넓은 침대가 놓인 LIMEN 투룸 침실" },
};
export const RATE_ROWS: { key: "weekday" | "friday" | "saturday" | "shoulder" | "peak"; label: string; note: string }[] = [
  { key: "weekday", label: "주중", note: "일–목" },
  { key: "friday", label: "금요일", note: "" },
  { key: "saturday", label: "주말", note: "토요일" },
  { key: "shoulder", label: "준성수기", note: "아래 기간" },
  { key: "peak", label: "극성수기", note: "아래 기간" },
];

export type Space = {
  key: string; label: string; title: string; body: string; points: string[];
  photo: { src: string; small: string }; alt: string;
};
// 공간 둘러보기 — 객실별 사진. 설명은 사진에서 확인되는 것만 적는다.
export const SPACES_BY_ROOM: Record<RoomKey, Space[]> = {
  one: [
    {
      key: "one-living", label: "LIVING", title: "낮은 가벽이 나누는 방",
      body: "낮은 가벽 하나가 공간을 둘로 나눕니다. 창으로는 바깥의 나무가 보이고, 미닫이문 너머로 다음 공간이 이어집니다.",
      points: ["낮은 가벽", "창가 자리", "벽걸이 에어컨"],
      photo: photo("one-living"), alt: "낮은 가벽과 창, 미닫이문이 보이는 LIMEN 원룸",
    },
    {
      key: "one-bed", label: "BED", title: "우드 패널이 감싸는 침대",
      body: "오크 패널이 머리맡과 옆을 감싸는 침대 자리입니다. 벽등과 콘센트, 작은 선반이 양쪽에 하나씩 있습니다.",
      points: ["2인 침대", "벽등 2", "머리맡 콘센트 · 선반"],
      photo: photo("one-bed"), alt: "오크 패널이 감싼 침대와 벽등이 있는 LIMEN 원룸 침대 자리",
    },
    {
      key: "one-dining", label: "DINING", title: "창가의 식탁",
      body: "창 옆에 식탁과 의자 네 개를 두었습니다. 주방과 한 걸음 거리라 차린 음식을 바로 올리기 좋습니다.",
      points: ["식탁 · 의자 4", "창 · 블라인드", "전자레인지"],
      photo: photo("one-dining"), alt: "창가에 식탁과 의자 네 개가 놓인 LIMEN 원룸 주방",
    },
    {
      key: "one-kitchen", label: "KITCHEN", title: "오크 하부장과 밝은 상판",
      body: "오크 하부장 위로 밝은 상판과 벽이 이어집니다. 인덕션과 싱크, 정수기가 한 줄로 놓여 있습니다.",
      points: ["인덕션", "싱크", "정수기"],
      photo: photo("one-kitchen"), alt: "오크 하부장과 밝은 상판, 정수기가 놓인 LIMEN 원룸 주방",
    },
    {
      key: "official-studio-powder", label: "POWDER ROOM", title: "창 옆의 파우더룸",
      body: "창으로 빛이 들어오는 원룸 파우더룸입니다. 목재 문과 전신 거울이 이어집니다.",
      points: ["파우더룸", "전신 거울"],
      photo: photo("official-studio-powder"), alt: "전신 거울과 창이 있는 LIMEN 원룸 파우더룸",
    },
  ],
  two: [
    {
      key: "twin", label: "TWIN ROOM", title: "문 너머, 나란한 두 자리",
      body: "낮은 우드 플랫폼 위에 싱글 침대 두 개를 나란히 올렸습니다. 머리맡 선반과 콘센트가 침대마다 하나씩 있습니다.",
      points: ["싱글 침대 2", "헤드보드 선반 · 콘센트", "벽걸이 에어컨"],
      photo: photo("twin"), alt: "열린 문 너머로 우드 플랫폼 위 싱글 침대 두 개가 보이는 LIMEN 트윈룸",
    },
    {
      key: "bedroom", label: "MASTER BEDROOM", title: "우드 월이 감싸는 침실",
      body: "벽을 따라 두른 오크 패널이 침대를 감쌉니다. 길게 난 가로창에는 블라인드를 달아 아침 빛을 원하는 만큼만 들일 수 있습니다.",
      points: ["라지 사이즈 침대", "가로창 · 블라인드", "침대 옆 협탁 · 콘센트"],
      photo: photo("bedroom"), alt: "오크 패널 벽과 넓은 침대가 놓인 LIMEN 침실",
    },
    {
      key: "kitchen", label: "KITCHEN", title: "간접조명이 켜지는 주방",
      body: "오크 수납장과 밝은 상판, 조리대 위로 켜지는 간접조명. 큰 냉장고와 인덕션, 정수기가 있어 한 끼를 차리기 좋습니다.",
      points: ["대형 냉장고", "인덕션 · 정수기", "조리도구 · 식기건조대"],
      photo: photo("kitchen"), alt: "오크 수납장과 빌트인 냉장고가 있는 LIMEN 주방",
    },
    {
      key: "dressing", label: "DRESSING & LAUNDRY", title: "수납과 세탁, 문 하나 뒤에",
      body: "한쪽 벽을 가득 채운 붙박이장에 짐을 풀고, 미닫이문 뒤 세탁실에서 빨래까지. 며칠을 머물러도 짐이 늘지 않습니다.",
      points: ["벽면 붙박이장", "세탁기 · 건조기", "분리된 세탁실"],
      photo: photo("dressing"), alt: "벽면 붙박이장과 미닫이문 너머 세탁기가 보이는 LIMEN 드레스룸",
    },
    {
      key: "bath", label: "BATHROOM", title: "따뜻한 빛의 욕실",
      body: "거울 위로 번지는 간접조명과 베이지 톤 타일. 유리문으로 나뉜 샤워부스가 따로 있습니다.",
      points: ["유리문 샤워부스", "간접조명 거울", "세면대 · 수건걸이"],
      photo: photo("bath"), alt: "간접조명 거울과 샤워부스가 있는 LIMEN 욕실",
    },
    {
      key: "official-suite-dining", label: "DINING", title: "볕이 드는 식탁",
      body: "창가에 놓인 식탁과 바로 옆 주방입니다. 함께 식사하기 편하게 네 자리를 두었습니다.",
      points: ["4인 식탁", "주방과 이어지는 자리"],
      photo: photo("official-suite-dining"), alt: "창가 4인 식탁과 주방이 보이는 LIMEN 투룸",
    },
    {
      key: "official-suite-vanity", label: "VANITY", title: "창가에 마련한 화장대",
      body: "거울 앞에 앉아 머무는 동안 차분하게 외출 준비를 할 수 있는 자리입니다.",
      points: ["화장대", "거울 · 스툴"],
      photo: photo("official-suite-vanity"), alt: "거울과 나무 스툴이 놓인 LIMEN 투룸 화장대",
    },
  ],
};
export const SPACES: Space[] = ROOM_KEYS.flatMap(key => SPACES_BY_ROOM[key]);
const space = (key: string) => { const found = SPACES.find(s => s.key === key); if (!found) throw Error(`unknown space ${key}`); return { photo: found.photo, alt: found.alt }; };

// 공식 제공 사진: staylimen.com/photos/{studio/bed,studio/powder,suite/dining,suite/vanity}.jpg
// 예약은 객실 타입 기준이므로 사진의 특정 호실을 보장하지 않는다.
export const STAY_SNAPSHOT_PHOTOS = [
  { photo: photo("official-studio-bed"), alt: "나무 헤드보드와 싱글 침대가 나란한 LIMEN 원룸 침실", label: "원룸 · 침실", height: 714 },
  { ...space("official-suite-dining"), label: "투룸 · 창가 식탁", height: 1267 },
];

// 공식 사이트(staylimen.com) 기준 시설·하우스룰. 가격·프로모션·문자 발송 조건은 예약 채널별로 달라 가져오지 않는다.
export const STAY_FACILITIES = [
  { title: "개별 주방과 욕실", body: "원룸과 투룸 모두 전용 주방과 독립된 욕실을 갖추고 있습니다." },
  { title: "욕실 어메니티", body: "고체 샴푸와 바디바 등 객실용 어메니티가 제공됩니다." },
  { title: "JMW 헤어드라이어", body: "원룸과 투룸 모두 객실 안에 헤어드라이어가 있습니다." },
  { title: "건물 1층 GS25", body: "음료나 간식, 간단한 생활용품을 같은 건물에서 구할 수 있습니다." },
];
export const STAY_STANDARD_HOURS = { checkIn: "15:00", checkOut: "11:00" };
export const STAY_HOUSE_RULES = ["객실에서는 흡연할 수 없습니다.", "반려동물은 동반할 수 없습니다.", "예약 인원 외 방문과 파티는 불가합니다."];

// '문을 지나는' 장면, 스토리·맺음에 쓰는 실제 공간 사진
export const PASSAGE_PHOTO = space("dressing");
export const STORY_PHOTO = space("kitchen");
export const CLOSING_PHOTO = space("bath");

// 사진으로 확인되는 비품 (객실별)
export const AMENITIES: Record<RoomKey, { group: string; items: string[] }[]> = {
  one: [
    { group: "침대", items: ["2인 침대", "벽등", "머리맡 콘센트 · 선반"] },
    { group: "주방", items: ["인덕션", "전자레인지", "정수기", "싱크"] },
    { group: "생활", items: ["식탁 · 의자 4", "에어컨", "블라인드"] },
  ],
  two: [
    { group: "침실", items: ["라지 베드", "싱글 베드 2", "헤드보드 콘센트", "블라인드", "에어컨"] },
    { group: "주방", items: ["대형 냉장고", "인덕션", "정수기", "조리도구", "식기건조대"] },
    { group: "생활", items: ["세탁기", "건조기", "벽면 붙박이장"] },
    { group: "욕실", items: ["샤워부스", "세면대", "간접조명 거울"] },
  ],
};

// 동네 안내 — 널리 알려진 사실만. 숙소 기준 거리·시간은 주소 확정 전이라 적지 않는다.
export const NEIGHBORHOOD: { key: string; title: string; body: string }[] = [
  { key: "park", title: "경의선숲길", body: "옛 철길을 따라 길게 이어지는 공원. 연남동 구간은 ‘연트럴파크’라는 별명으로 불립니다." },
  { key: "alley", title: "연남동 골목", body: "주택가 사이사이에 작은 카페와 식당, 소품 가게가 숨어 있는 동네." },
  { key: "hongdae", title: "홍대 거리", body: "공연과 쇼핑, 늦게까지 불이 켜진 가게들. 홍대입구역 건너편이 바로 홍대입니다." },
  { key: "arex", title: "공항철도", body: "인천공항·김포공항에서 홍대입구역까지 환승 없이 한 번에 닿습니다." },
];
export const TRANSIT: { label: string; value: string; note: string }[] = [
  { label: "가까운 역", value: "홍대입구역", note: "2호선 · 공항철도 · 경의중앙선" },
  { label: "인천공항 T1", value: "약 50분", note: "공항철도 일반열차 · 환승 없음" },
  { label: "김포공항", value: "약 15분", note: "공항철도 · 환승 없음" },
];

export const KAKAO_URL = "https://pf.kakao.com/_VyING/chat";
export const NAVER_MAP_URL = "https://map.naver.com/p/search/" + encodeURIComponent("연남동");
export const KAKAO_MAP_URL = "https://map.kakao.com/?q=" + encodeURIComponent("연남동");

// 관리자 설정 중 화면에 쓰는 값 (lib/limen-core.cjs 의 DEFAULT_CONFIG 에서 비공개 값을 뺀 것)
export type RoomRates = { open: boolean; guests: number; weekday: number | null; friday: number | null; saturday: number | null; shoulder: number | null; peak: number | null };
export type StayConfig = {
  open: boolean; minLeadDays: number; maxNights: number; windowDays: number;
  rooms: Record<RoomKey, RoomRates>;
  checkInTime: string; checkOutTime: string; address: string; walkNote: string; parkingNote: string;
  mapUrl: string; notice: string; rules: string;
  autoSeasons: boolean; // 시즌 달력(준성수기·극성수기·공휴일 전날)을 자동으로 적용하는지
  payOnline: boolean; refundTerms: string;
};
