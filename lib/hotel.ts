/**
 * 호텔공구(여수 UTOP 마리나) 달력 예약 — 시즌 티어 기반 요금/재고 설정.
 *
 * ⚠️ 표시 가격은 사진 요금표 기준의 "대략적 금액대"입니다. 실제 판매가가 확정되면
 * 아래 PRICE 표(만원 단위)와 SEASON_RANGES / SOLD_OUT 만 고치면 전 화면에 반영됩니다.
 */

export type Tier = "weekday" | "saturday" | "shoulder" | "peak" | "highpeak";
export type PkgKey = "p2" | "p3" | "p4";
export type RoomType = "디럭스 더블" | "패밀리 트윈";

export const TIERS: Record<Tier, { label: string; text: string; bg: string; chip: string }> = {
  weekday:  { label: "주중·금요일", text: "#4b5563", bg: "#ffffff", chip: "#e5e7eb" },
  saturday: { label: "토요일",     text: "#2563eb", bg: "#eff6ff", chip: "#bfdbfe" },
  shoulder: { label: "준성수기",   text: "#15803d", bg: "#f0fdf4", chip: "#bbf7d0" },
  peak:     { label: "연휴·성수기", text: "#c2410c", bg: "#fff7ed", chip: "#fed7aa" },
  highpeak: { label: "극성수기",   text: "#dc2626", bg: "#fef2f2", chip: "#fecaca" },
};

// 공동구매 예약 가능(투숙) 기간
export const BOOKABLE_FROM = "2026-07-13";
export const BOOKABLE_TO = "2026-10-31";

// 판매(주문 가능) 기간
export const SALE_FROM = "2026-07-04";
export const SALE_TO = "2026-07-07";
// 판매 오픈 일시(KST) — 이 시각부터 예약/결제 가능
export const SALE_START = "2026-07-04T10:00:00+09:00";
// 공동구매 마감 일시(KST) = 판매 종료일 끝. 카운트다운 기준.
export const GROUPBUY_DEADLINE = "2026-07-07T23:59:59+09:00";

// 판매 상태: 오픈 전 / 진행 중 / 마감
export function saleState(): "before" | "open" | "closed" {
  const now = Date.now();
  if (now < new Date(SALE_START).getTime()) return "before";
  if (now > new Date(GROUPBUY_DEADLINE).getTime()) return "closed";
  return "open";
}

export function ymdKor(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
}
export function mdKor(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(m).padStart(2, "0")}월 ${String(d).padStart(2, "0")}일`;
}

// 업체정보 — 투숙객 제휴 혜택(그 외 즐길거리)
export const PARTNER_BENEFITS: { title: string; lines: string[] }[] = [
  {
    title: "① 낭만포차24번 (본관·2관) 10% 할인",
    lines: [
      "모든 음식류 10% 할인 (음주류 제외)",
      "이용방법: 결제 시 낭만포차24번 데스크에 유탑 마리나 호텔 예약 내역 확인 후 할인가 결제",
      "유효기간: 입실일 ~ 퇴실일 (퇴실 이후 이용불가)",
      "운영시간: (유동적) 13:00 ~ 03:00",
    ],
  },
  {
    title: "② 여수 맛나당 딸기모찌 10% 할인",
    lines: [
      "기본모찌 6구·10구 구입 시",
      "이용방법: 결제 시 여수 맛나당 데스크에 예약 내역 확인 후 할인가 결제",
      "유효기간: 입실일 ~ 퇴실일 (퇴실 이후 이용불가)",
      "운영시간: 10:00 ~ 22:00",
      "이용장소: 전남 여수시 중앙로 72-6 1층 (이순신광장)",
    ],
  },
  {
    title: "③ 야간 요트 투어",
    lines: [
      "이용방법: 유탑 마리나 호텔 1층 요트 데스크 방문",
      "이용요금: 1인 25,000원 (주중 월~목 50% 할인가)",
      "유효기간: 입실일 ~ 퇴실 전 (퇴실 시 이용불가)",
      "운영시간: 출항 일정 홈페이지 참고 (월별 상이)",
      "※ 매주 금~일, 7월 말~8월 중순은 할인 제공이 어려우며 투숙객 할인가 42,000원 적용",
      "이용장소: 전남 여수시 중앙로 72-6 1층 (이순신광장)",
    ],
  },
  {
    title: "④ 아쿠아플라넷 (대인권) 20% 할인 · 정가 37,900원",
    lines: [
      "이용방법: 체크인 시 프런트에서 티켓 구매",
      "이용요금: 성인 1매 30,320원 (20% 할인)",
      "유효기간: 아쿠아플라넷 입장권 유효기간 내",
      "운영시간: 09:30 ~ 20:00 (매표 마감 18:00) / 홈페이지 확인 필수",
      "36개월 미만 무료입장 (증빙서류 지참 필수 · 직계가족 동반에 한함)",
    ],
  },
  {
    title: "⑤ 블루 요트 · 주간 요트 1인 무료 + 동반자 추가 할인",
    lines: [
      "이용방법: 유탑 마리나 호텔 1층 요트 데스크 방문",
      "이용요금: 객실당 1인 무료(박수 무관 1회), 동반자 1인 15,000원 (40% 할인)",
      "36개월 미만 무료입장 (증빙서류 지참 필수 · 직계가족 동반에 한함)",
      "유효기간: 입실일 ~ 퇴실 전 (퇴실 시 이용불가)",
      "운영시간: 10:00 ~ 20:00 (출항시간 상이, 요트 데스크 확인 필수)",
      "출발시간(주간): 09:40 / 10:20 / 11:00 / 11:40 / 12:20 / 14:00 / 14:40 / 15:20 / 16:00",
    ],
  },
];

// 예약 및 취소 규정
export const REFUND_POLICY: { when: string; rate: string }[] = [
  { when: "체크인일 기준 6일 전", rate: "100% 환불" },
  { when: "체크인일 기준 5~3일 전", rate: "50% 환불" },
  { when: "체크인일 기준 2~1일 전", rate: "30% 환불" },
  { when: "체크인 당일 · No-show", rate: "환불 불가" },
];

// 호텔 정보 (결제 요약 카드용)
export const HOTEL = {
  name: "여수 UTOP 마리나 호텔",
  tagline: "여수 엑스포 · 오션뷰 리조트",
  image: "/hotel/4.png",
  checkInTime: "15:00",
  checkOutTime: "11:00",
};

// 시즌 구간(범위) — 이 안의 날짜는 해당 티어, 나머지는 토요일/주중 규칙(금요일=주중)
const SEASON_RANGES: { from: string; to: string; tier: Tier }[] = [
  { from: "2026-07-17", to: "2026-07-18", tier: "peak" },
  { from: "2026-07-19", to: "2026-07-23", tier: "shoulder" },
  { from: "2026-07-26", to: "2026-07-29", tier: "peak" },
  { from: "2026-07-30", to: "2026-08-16", tier: "highpeak" },
  { from: "2026-09-23", to: "2026-09-23", tier: "shoulder" },
  { from: "2026-09-24", to: "2026-09-26", tier: "peak" },
  { from: "2026-10-02", to: "2026-10-02", tier: "shoulder" },
  { from: "2026-10-03", to: "2026-10-04", tier: "peak" },
  { from: "2026-10-08", to: "2026-10-08", tier: "shoulder" },
  { from: "2026-10-09", to: "2026-10-10", tier: "peak" },
];

export function getTier(iso: string): Tier {
  for (const r of SEASON_RANGES) if (iso >= r.from && iso <= r.to) return r.tier;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 6 ? "saturday" : "weekday";
}

// 패키지 × 티어 → 1박 판매가(원). 금요일 = 주중과 동일.
const RATE: Record<PkgKey, Record<Tier, number>> = {
  p2: { weekday: 139000, saturday: 229000, shoulder: 199000, peak: 289000, highpeak: 359000 },
  p3: { weekday: 169000, saturday: 259000, shoulder: 229000, peak: 319000, highpeak: 389000 },
  p4: { weekday: 199000, saturday: 289000, shoulder: 259000, peak: 349000, highpeak: 419000 },
};

// 2박 = (밤1 1박가 + 밤2 1박가) − 연박 할인(원)
const TWO_NIGHT_DISCOUNT: Record<PkgKey, number> = { p2: 9000, p3: 39000, p4: 69000 };

// 객실 정가(원, 1박) — 정가 대비 할인 표시용
export const LIST_PRICE: Record<PkgKey, Partial<Record<RoomType, number>>> = {
  p2: { "디럭스 더블": 500000, "패밀리 트윈": 600000 },
  p3: { "패밀리 트윈": 600000 },
  p4: { "패밀리 트윈": 600000 },
};

export const PACKAGES: Record<PkgKey, {
  label: string;
  people: string;
  rooms: RoomType[];
  includes: string[];
}> = {
  p2: {
    label: "2인 패키지",
    people: "성인 2인",
    rooms: ["디럭스 더블", "패밀리 트윈"],
    includes: ["오션뷰 객실", "조식 2인", "인피니티풀 2인", "레이트 체크아웃 (13시)"],
  },
  p3: {
    label: "3인 패키지",
    people: "성인 3인",
    rooms: ["패밀리 트윈"],
    includes: ["오션뷰 객실", "조식 3인", "인피니티풀 3인", "레이트 체크아웃 (13시)"],
  },
  p4: {
    label: "4인 패키지",
    people: "성인 4인",
    rooms: ["패밀리 트윈"],
    includes: ["오션뷰 객실", "조식 4인", "인피니티풀 4인", "레이트 체크아웃 (13시)"],
  },
};

// 객실 타입별 정보 (침대·인원·사진). 사진은 public/room/ 에 넣으면 표시.
export const ROOM_META: Record<RoomType, { bed: string; capacity: string; images: string[] }> = {
  "디럭스 더블": {
    bed: "더블침대 1개",
    capacity: "최대 2인 (36개월 미만 1명 추가 시 3인)",
    images: ["/room/double-1.png", "/room/double-2.png"],
  },
  "패밀리 트윈": {
    bed: "퀸사이즈 침대 2개",
    capacity: "최대 4인 (36개월 미만 1명 추가 시 5인)",
    images: ["/room/twin-1.png", "/room/twin-2.png"],
  },
};

// 1박 요금(원)
export function nightlyWon(pkg: PkgKey, iso: string): number {
  return RATE[pkg][getTier(iso)];
}

// 연박 총요금(원) = 밤별 1박가 합 − (박수−1) × 연박할인
export function stayPriceWon(pkg: PkgKey, checkin: string, nights: number): number {
  let sum = 0;
  let cur = checkin;
  for (let i = 0; i < nights; i++) { sum += RATE[pkg][getTier(cur)]; cur = nextISO(cur); }
  return sum - Math.max(0, nights - 1) * TWO_NIGHT_DISCOUNT[pkg];
}

// 정가(원) — 선택 박수만큼
export function listWon(pkg: PkgKey, room: RoomType, nights: number): number {
  return (LIST_PRICE[pkg][room] ?? 0) * nights;
}

// 체크인일부터 연속 예약 가능한 최대 박수(예약기간 내 + 재고 있는 날까지)
export function maxNightsFrom(room: RoomType, checkin: string): number {
  let n = 0;
  let cur = checkin;
  while (cur <= BOOKABLE_TO && !isSoldOut(room, cur)) { n++; cur = nextISO(cur); }
  return Math.max(1, n);
}

// 입실~퇴실 사이 박수
export function nightsBetween(checkIn: string, checkOut: string): number {
  const [ay, am, ad] = checkIn.split("-").map(Number);
  const [by, bm, bd] = checkOut.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// M/D 표기
export function mdLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

// 예약 검증 + 금액 재계산 (서버에서 클라 값 미신뢰용)
export function quoteReservation(pkgRaw: string, roomRaw: string, checkIn: string, checkOut: string) {
  if (!(pkgRaw in PACKAGES)) return null;
  const pkg = pkgRaw as PkgKey;
  if (!PACKAGES[pkg].rooms.includes(roomRaw as RoomType)) return null;
  const room = roomRaw as RoomType;
  if (!checkIn || !checkOut || checkIn < BOOKABLE_FROM || checkIn > BOOKABLE_TO) return null;
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > maxNightsFrom(room, checkIn)) return null;
  return { pkg, room, checkIn, checkOut, nights, total: stayPriceWon(pkg, checkIn, nights), label: PACKAGES[pkg].label };
}

// 요금 상세: 밤별 1박 요금 + 연박(공구) 할인 + 총액
export function stayBreakdown(pkg: PkgKey, checkIn: string, nights: number) {
  const items: { iso: string; won: number }[] = [];
  let cur = checkIn;
  for (let i = 0; i < nights; i++) { items.push({ iso: cur, won: RATE[pkg][getTier(cur)] }); cur = nextISO(cur); }
  const discount = Math.max(0, nights - 1) * TWO_NIGHT_DISCOUNT[pkg];
  const total = items.reduce((s, x) => s + x.won, 0) - discount;
  return { items, discount, total };
}

// 달력 셀용 간결 표기: 139000 → "13.9만", 200000 → "20만"
export function manLabel(won: number): string {
  const man = won / 10000;
  return (Number.isInteger(man) ? `${man}` : man.toFixed(1)) + "만";
}

// 배정 객실 마감(품절) 날짜 — 첫 사진(배정 객실 수)의 '마감' 반영
const SOLD_OUT: Record<RoomType, string[]> = {
  "디럭스 더블": ["2026-07-14", "2026-07-15", "2026-07-17", "2026-08-19"],
  "패밀리 트윈": ["2026-07-17", "2026-07-22", "2026-07-23", "2026-08-19", "2026-09-09"],
};
export function isSoldOut(room: RoomType, iso: string): boolean {
  return SOLD_OUT[room].includes(iso);
}

export function nextISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export const WON = (n: number) => `${n.toLocaleString()}원`;
