// LIMEN 예약 화면들이 함께 쓰는 타입·표시 형식·API 호출 (달력 예약, 결제 결과).
import type { RoomKey } from "@/components/limen/content";

export const DAY = 86400000;
export const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
export const weekdayOf = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();
export const shortDate = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))} (${WEEK[weekdayOf(day)]})`;
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// requested: 신청 접수(결제 없음) · pending: 결제 대기 · confirming: 결제 승인 확인 중 · confirmed: 확정
// cancelling: 환불 확인 중 · expired: 결제하지 않고 끝남
export type StayStatus = "requested" | "pending" | "confirming" | "confirmed" | "cancelling" | "cancelled" | "declined" | "expired";
// 그 밤에 적용된 요금 종류 (custom = 날짜에 따로 지정한 요금)
export type RateKind = "weekday" | "friday" | "saturday" | "shoulder" | "peak" | "custom";
export type StayBooking = {
  code: string; status: StayStatus; room: RoomKey; roomName: string;
  checkIn: string; checkOut: string; nights: number; guests: number; guestName: string;
  estimate: { nightly?: { day: string; price: number | null; rate?: RateKind }[]; total?: number | null; refundTerms?: string };
  cancelRequested: boolean; createdAt: string;
  // 카드로 결제한 예약일 때만 값이 있다
  paid: boolean; amount: number | null; refundAmount: number | null; receiptUrl: string | null; expiresAt: string | null;
};
// 결제 단계 응답 — orderId·amount로 결제창을 연다. payable=false 면 이미 결제 단계가 끝난 예약.
export type StayOrder = { booking: StayBooking; orderId: string; amount: number | null; payable: boolean };
// 객실별 달력: 닫힌 날 · 이미 잡힌 밤 · 날짜별 1박 요금(서버가 시즌까지 계산) · 시즌 표시
export type RoomCalendar = { closed: string[]; taken: string[]; prices: Record<string, number | null>; seasons: Record<string, "shoulder" | "peak"> };

export const STATUS: Record<StayStatus, string> = {
  requested: "일정 확인 중", pending: "결제 대기", confirming: "결제 확인 중", confirmed: "예약 확정",
  cancelling: "환불 확인 중", cancelled: "취소됨", declined: "예약 불가", expired: "결제 미완료",
};
export const SEASON: Record<"shoulder" | "peak", string> = { shoulder: "준성수기", peak: "극성수기" };

export async function stayApi<T = StayBooking>(input: object): Promise<T> {
  const response = await fetch("/api/limen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
  return data;
}
