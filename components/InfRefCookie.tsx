"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 인플루언서 링크(?inf=)로 들어오면 귀속 정보를 쿠키(7일)에 저장.
 * 장바구니에 담았다 나중에 결제하거나, 사이트를 구경하다 URL에서 ?inf=가 사라져도
 * 결제 승인 라우트가 이 쿠키로 귀속을 복원한다 (URL 값이 항상 우선, 새 링크 클릭 시 갱신).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Inner() {
  const inf = useSearchParams().get("inf");
  useEffect(() => {
    if (inf && UUID_RE.test(inf)) {
      document.cookie = `inf_ref=${inf}; path=/; max-age=${7 * 86400}; samesite=lax`;
    }
  }, [inf]);
  return null;
}

export default function InfRefCookie() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
