// 광고·분석 태그 설정 — 메타(페이스북·인스타그램) 픽셀.
// 블랜드픽·산지픽 두 사이트 모두 같은 픽셀로 잡는다 (광고 계정이 하나). 사이트별로 나눠야 하면 여기서 키를 분기.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2567356913769604";

// 클라이언트에서 fbq 가 있으면 이벤트 전송 (픽셀 미로드·광고 차단 환경에서도 조용히 무시)
export function fbqTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { fbq?: (...args: unknown[]) => void };
  if (typeof w.fbq !== "function") return;
  try {
    if (params) w.fbq("track", event, params);
    else w.fbq("track", event);
  } catch {
    // 광고 스크립트 오류가 결제 완료 화면을 깨면 안 됨
  }
}
