// 토스 결제창 호출 공통 유틸 — 세 결제 화면(상품·장바구니·호텔)이 공유

// 토스 requestPayment의 customerMobilePhone은 형식이 틀리면 결제창도 못 열고 예외가 난다.
// 숫자만 남기고 010… 휴대폰 형식일 때만 넘기고, 아니면 생략(선택 값이라 없어도 결제 가능).
export function tossMobilePhone(raw: string): string | undefined {
  let d = (raw || "").replace(/[^0-9]/g, "");
  if (d.startsWith("82")) d = "0" + d.slice(2);
  if (!d.startsWith("0") && /^1[016789]/.test(d)) d = "0" + d; // 앞 0 누락 복원
  return /^01[016789][0-9]{7,8}$/.test(d) ? d : undefined;
}

// 결제창 예외 → 사용자에게 보여줄 메시지 (사용자가 창을 닫은 경우는 null = 조용히 무시)
export function payErrorMessage(e: unknown): string | null {
  const err = e as { code?: string; message?: string };
  if (err?.code === "USER_CANCEL") return null;
  return err?.message || "결제창을 여는 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}
