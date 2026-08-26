// 숙박공구 카테고리에 나열되는 숙소 목록.
// 새 호텔·펜션 공구가 들어오면 여기에 항목만 추가하면 /hotel 카드 목록에 자동으로 나온다.
// status: "open"(예약 진행 중) | "soon"(오픈 준비 중) | "closed"(공구 마감 — 마감 표시로 노출, 링크 없음)
export interface Stay {
  key: string;
  type: "HOTEL" | "PENSION" | "RESORT";
  name: string;
  region: string;
  desc: string;
  image: string;
  href: string | null; // null이면 링크 없이 카드만 (COMING SOON 등)
  status: "open" | "soon" | "closed";
}

export const STAYS: Stay[] = [
  {
    key: "dangung",
    type: "PENSION",
    name: "단궁 펜션 — 독채 & 파티룸",
    region: "COMING SOON",
    desc: "넓은 정원을 통째로 쓰는 독채 펜션 공구를 준비하고 있어요 — 오픈 소식은 인플루언서 채널에서 가장 먼저",
    image: "/hotel/5.png",
    href: "/hotel/dangung",
    status: "soon",
  },
  {
    key: "utop-marina",
    type: "HOTEL",
    name: "여수 UTOP 마리나 호텔",
    region: "전남 여수 · 엑스포역 도보권",
    desc: "오션뷰 객실 공동구매 — 요트체험·아쿠아리움·여수 밤바다까지 한 번에",
    image: "/hotel/4.png",
    href: null,
    status: "closed",
  },
];
