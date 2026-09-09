"use client";
export default function SanjiError({ unstable_retry }: { unstable_retry: () => void }) {
  return <main data-storefront-state="error" style={{padding:40,textAlign:"center"}}><h1>상품 정보를 불러오지 못했습니다</h1><p>잠시 후 다시 시도해주세요.</p><button onClick={unstable_retry}>다시 시도</button></main>;
}
