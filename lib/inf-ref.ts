import { cookies } from "next/headers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 인플루언서 귀속 쿠키(inf_ref) — 링크(?inf=)로 들어올 때 클라이언트가 7일간 저장.
// 결제 승인 시 URL로 전달된 귀속이 없으면 이 값을 대신 사용한다 (URL 값이 항상 우선).
export async function infRefFromCookie(): Promise<string | null> {
  const v = (await cookies()).get("inf_ref")?.value;
  return v && UUID_RE.test(v) ? v : null;
}
