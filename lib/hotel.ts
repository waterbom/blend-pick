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

// 공동구매 예약 가능 기간
export const BOOKABLE_FROM = "2026-07-13";
export const BOOKABLE_TO = "2026-10-31";

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
