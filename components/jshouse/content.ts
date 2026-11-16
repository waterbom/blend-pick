// JS하우스(연남동) 페이지 콘텐츠 — 사진·문구는 여기만 고치면 화면에 반영된다.
//
// ★ 사진을 추가할 때
//   1) public/hotel/jshouse/ 에 큰 사진(name.webp)과 작은 사진(name-sm.webp, 가로 520px)을 넣고
//   2) 아래 SPACES 에 항목을 추가하거나 기존 항목의 photo 를 바꾼다.
// 문구는 사진에서 확인되는 사실만 적는다. 요금·주소·입실 시간처럼 운영자가 정하는 값은
// 관리자 화면(/admin/jshouse)에서 입력하며, 비어 있으면 "예약 확정 시 안내"로 표시된다.

export const JSH_PATH = "/hotel/jshouse";
export const JSH_URL = "https://shop.blendpunch.com/hotel/jshouse";
const photo = (name: string) => ({ src: `/hotel/jshouse/${name}.webp`, small: `/hotel/jshouse/${name}-sm.webp` });

export type Space = {
  key: string; label: string; title: string; body: string; points: string[];
  photo: { src: string; small: string }; alt: string;
};

export const SPACES: Space[] = [
  {
    key: "bedroom", label: "MASTER BEDROOM", title: "침실 하나, 우드 월",
    body: "벽을 따라 두른 오크 패널이 침대를 감싸는 방. 길게 난 가로창에는 블라인드를 달아 아침 빛을 원하는 만큼만 들일 수 있어요.",
    points: ["라지 사이즈 침대", "가로창 · 블라인드", "침대 옆 협탁 · 콘센트"],
    photo: photo("bedroom"), alt: "오크 패널 벽과 넓은 침대가 놓인 JS하우스 침실",
  },
  {
    key: "twin", label: "TWIN ROOM", title: "침실 둘, 나란한 두 자리",
    body: "낮은 우드 플랫폼 위에 싱글 침대 두 개를 나란히 올렸어요. 머리맡 선반과 콘센트가 침대마다 하나씩 있습니다.",
    points: ["싱글 침대 2", "헤드보드 선반 · 콘센트", "벽걸이 에어컨"],
    photo: photo("twin"), alt: "우드 플랫폼 위에 싱글 침대 두 개가 놓인 JS하우스 트윈룸",
  },
  {
    key: "kitchen", label: "KITCHEN", title: "주방, 해 먹는 여행",
    body: "오크 수납장과 밝은 상판, 조리대 위로 켜지는 간접조명. 큰 냉장고와 인덕션, 정수기가 있어 장을 봐 와서 한 끼를 차리기 좋아요.",
    points: ["대형 냉장고", "인덕션 · 정수기", "조리도구 · 식기건조대"],
    photo: photo("kitchen"), alt: "오크 수납장과 빌트인 냉장고가 있는 JS하우스 주방",
  },
  {
    key: "dressing", label: "DRESSING & LAUNDRY", title: "수납과 세탁, 긴 여행도 가볍게",
    body: "한쪽 벽을 가득 채운 붙박이장에 짐을 풀고, 미닫이문 뒤 세탁실에서 빨래까지. 며칠을 머물러도 짐이 늘지 않습니다.",
    points: ["벽면 붙박이장", "세탁기 · 건조기", "분리된 세탁실"],
    photo: photo("dressing"), alt: "벽면 붙박이장과 세탁기가 보이는 JS하우스 드레스룸",
  },
  {
    key: "bath", label: "BATHROOM", title: "욕실, 따뜻한 빛",
    body: "거울 위로 번지는 간접조명과 베이지 톤 타일. 유리문으로 나뉜 샤워부스가 따로 있어요.",
    points: ["유리문 샤워부스", "간접조명 거울", "세면대 · 수건걸이"],
    photo: photo("bath"), alt: "간접조명 거울과 샤워부스가 있는 JS하우스 욕실",
  },
];

export const HERO = {
  main: SPACES[0].photo, mainAlt: SPACES[0].alt,
  sub: SPACES[2].photo, subAlt: SPACES[2].alt,
};

// 한눈에 보기 — 사진으로 확인되는 구성. value 가 숫자면 화면에서 카운트업된다.
export const GLANCE: { icon: "bed" | "beds" | "kitchen" | "laundry" | "bath" | "air"; value?: number; unit?: string; title: string; note: string }[] = [
  { icon: "bed", value: 2, unit: "개", title: "침실", note: "분리된 방 두 개" },
  { icon: "beds", value: 3, unit: "개", title: "침대", note: "라지 1 · 싱글 2" },
  { icon: "kitchen", title: "주방", note: "냉장고 · 인덕션 · 정수기" },
  { icon: "laundry", title: "세탁실", note: "세탁기 · 건조기" },
  { icon: "bath", title: "욕실", note: "유리문 샤워부스" },
  { icon: "air", title: "에어컨", note: "침실 벽걸이형" },
];

export const AMENITIES: { group: string; items: string[] }[] = [
  { group: "주방", items: ["대형 냉장고", "인덕션", "정수기", "조리도구", "식기건조대"] },
  { group: "침실", items: ["라지 베드", "싱글 베드 2", "헤드보드 콘센트", "블라인드", "에어컨"] },
  { group: "생활", items: ["세탁기", "건조기", "벽면 붙박이장"] },
  { group: "욕실", items: ["샤워부스", "세면대", "간접조명 거울"] },
];

// 동네 안내 — 연남동에 대해 널리 알려진 사실만. 숙소 기준 거리·시간은 주소 확정 전이라 적지 않는다.
export const NEIGHBORHOOD: { key: string; title: string; body: string }[] = [
  { key: "park", title: "경의선숲길", body: "옛 철길을 따라 길게 이어지는 공원. 연남동 구간은 ‘연트럴파크’라는 별명으로 불려요." },
  { key: "alley", title: "연남동 골목", body: "주택가 사이사이에 작은 카페와 식당, 소품 가게가 숨어 있는 동네." },
  { key: "hongdae", title: "홍대 거리", body: "공연과 쇼핑, 늦게까지 불이 켜진 가게들. 홍대입구역 건너편이 바로 홍대예요." },
  { key: "arex", title: "공항철도", body: "인천공항·김포공항에서 홍대입구역까지 환승 없이 한 번에 닿아요." },
];

export const TRANSIT: { label: string; value: string; note: string }[] = [
  { label: "가까운 역", value: "홍대입구역", note: "2호선 · 공항철도 · 경의중앙선" },
  { label: "인천공항 T1", value: "약 50분", note: "공항철도 일반열차 · 환승 없음" },
  { label: "김포공항", value: "약 15분", note: "공항철도 · 환승 없음" },
];

export const MARQUEE = ["JS HOUSE", "연남동 프라이빗 스테이", "Oak & White", "하루 한 팀", "Stay slow in Yeonnam"];

export const KAKAO_URL = "https://pf.kakao.com/_VyING/chat";
export const NAVER_MAP_URL = "https://map.naver.com/p/search/" + encodeURIComponent("연남동");
export const KAKAO_MAP_URL = "https://map.kakao.com/?q=" + encodeURIComponent("연남동");

// 관리자 설정 중 화면에 쓰는 값 (lib/jshouse-core.cjs 의 DEFAULT_CONFIG 에서 비공개 값을 뺀 것)
export type StayConfig = {
  open: boolean; minLeadDays: number; maxNights: number; windowDays: number; maxGuests: number;
  weekdayPrice: number | null; weekendPrice: number | null;
  checkInTime: string; checkOutTime: string; address: string; walkNote: string; parkingNote: string;
  mapUrl: string; notice: string; rules: string;
};
