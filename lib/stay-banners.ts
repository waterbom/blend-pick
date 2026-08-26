// /hotel 상단 숙소별 배너 설정 — 숙소마다 풀블리드 슬라이드 배너 한 섹션씩 세로로 쌓인다.
//
// ★ 새 숙소 공구가 들어오면:
//   1) public/hotel/ 에 사진 업로드
//   2) 아래 배열 맨 앞에 항목 추가 (slides의 images 경로만 맞추면 끝)
// 슬라이드 1장당 사진 여러 장을 가로 균등 분할(object-cover)로 채운다.

export interface StaySlide {
  images: string[]; // public 기준 경로. 없으면 grad 배경이 대신 보임
  grad: string;     // 사진 로딩 전/누락 시 배경
  tag: string;
  title: string;    // \n 줄바꿈 가능
  subtitle: string;
  href: string;     // CTA 링크
  cta: string;      // CTA 버튼 문구
}

export interface StayBannerConfig {
  key: string;
  name: string; // 배너 사이 구분 밴드에 표시되는 숙소 이름
  slides: StaySlide[];
}

export const STAY_BANNERS: StayBannerConfig[] = [
  {
    key: "dangung",
    name: "단궁 펜션",
    slides: [
      {
        images: ["/hotel/dangung1.jpg", "/hotel/dangung2.jpg", "/hotel/dangung3.jpg"],
        grad: "linear-gradient(180deg,#7EB8DA,#7FB98B)",
        tag: "단궁 펜션 · 독채 & 파티룸",
        title: "단궁 X 블랜드픽\n펜션 공동구매",
        subtitle: "한옥과 넓은 잔디 정원 — 오픈 준비 중",
        href: "/hotel/dangung",
        cta: "단궁 공구 미리 보기",
      },
      {
        images: ["/hotel/dangung4.jpg", "/hotel/dangung5.jpg", "/hotel/dangung6.jpg", "/hotel/dangung7.jpg"],
        grad: "linear-gradient(135deg,#9ED0A8,#4E8F5C)",
        tag: "사계절의 단궁",
        title: "봄부터 겨울까지,\n계절이 머무는 정원",
        subtitle: "꽃 피는 봄, 짙푸른 여름, 물드는 가을, 고요한 겨울",
        href: "/hotel/dangung",
        cta: "단궁 공구 미리 보기",
      },
    ],
  },
  {
    key: "utop-marina",
    name: "UTOP 마리나 리조트",
    slides: [
      {
        images: ["/hotel/4.png", "/hotel/4.1.png", "/hotel/4.2.png"],
        grad: "linear-gradient(135deg,#16324f,#2b5f7d)",
        tag: "여수 엑스포 · UTOP 마리나",
        title: "오션뷰 리조트\n단독 공동구매",
        subtitle: "블랜드픽만의 특가로 만나는 프리미엄 스테이 — 이번 공구는 마감됐어요",
        href: "/hotel/utop",
        cta: "공구 상세 보기",
      },
      {
        images: ["/hotel/5.png", "/hotel/5.1.png", "/hotel/5.2.png"],
        grad: "linear-gradient(135deg,#155f4f,#2b7d63)",
        tag: "여수 여행",
        title: "호텔 외에도\n다양한 여수의 볼거리들!",
        subtitle: "요트체험 · 아쿠아리움 · 여수야시장까지, 여수를 통째로",
        href: "/hotel/utop",
        cta: "공구 상세 보기",
      },
    ],
  },
];
