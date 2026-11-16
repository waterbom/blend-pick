// JS하우스 예약 화면들이 함께 쓰는 타입·표시 형식·API 호출 (달력 예약, 결제 결과).

export const DAY = 86400000;
export const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
export const weekdayOf = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();
export const shortDate = (day: string) => `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))} (${WEEK[weekdayOf(day)]})`;
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

// requested: 신청 접수(결제 없음) · pending: 결제 대기 · confirming: 결제 승인 확인 중 · confirmed: 확정
// cancelling: 환불 확인 중 · expired: 결제하지 않고 끝남
export type StayStatus = "requested" | "pending" | "confirming" | "confirmed" | "cancelling" | "cancelled" | "declined" | "expired";
export type StayBooking = {
  code: string; status: StayStatus;
  checkIn: string; checkOut: string; nights: number; guests: number; guestName: string;
  estimate: { nightly?: { day: string; price: number | null }[]; total?: number | null; refundTerms?: string };
  cancelRequested: boolean; createdAt: string;
  // 카드로 결제한 예약일 때만 값이 있다
  paid: boolean; amount: number | null; refundAmount: number | null; receiptUrl: string | null; expiresAt: string | null;
};
// 결제 단계 응답 — orderId·amount로 결제창을 연다. payable=false 면 이미 결제 단계가 끝난 예약.
export type StayOrder = { booking: StayBooking; orderId: string; amount: number | null; payable: boolean };

export const STATUS: Record<StayStatus, string> = {
  requested: "일정 확인 중", pending: "결제 대기", confirming: "결제 확인 중", confirmed: "예약 확정",
  cancelling: "환불 확인 중", cancelled: "취소됨", declined: "예약 불가", expired: "결제 미완료",
};

export async function stayApi<T = StayBooking>(input: object): Promise<T> {
  const response = await fetch("/api/jshouse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
  return data;
}
