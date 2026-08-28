// 어드민 예약관리 — 숙소(호텔/펜션) 구분.
// 예약·재고 데이터엔 숙소 컬럼이 없어서 product_name / room_type 문자열로 판별한다.
// ★ 새 숙소가 생기면: StayKey에 키 추가 + STAY_FILTERS에 탭 추가 + 판별 함수에 규칙 추가.

export type StayKey = "utop" | "dangung";

export const STAY_FILTERS: { key: "" | StayKey; label: string }[] = [
  { key: "", label: "전체" },
  { key: "utop", label: "UTOP 마리나" },
  { key: "dangung", label: "단궁 펜션" },
];

// 예약 → 숙소: order_items.product_name (예: "여수 UTOP 마리나 · 3인 패키지 · 패밀리 트윈")
export function stayOfProduct(productName: string | null | undefined): StayKey {
  return (productName || "").includes("단궁") ? "dangung" : "utop";
}

// 재고 → 숙소: hotel_room_inventory.room_type
// UTOP: "디럭스 더블" | "패밀리 트윈" · 단궁: "단궁 …" 또는 "독채"/"파티룸"
export function stayOfRoomType(roomType: string): StayKey {
  if (roomType.includes("단궁") || roomType === "독채" || roomType === "파티룸") return "dangung";
  return "utop";
}
