"use client";

export default function RequestError({error, unstable_retry}: {error: Error & {digest?: string}; unstable_retry: () => void}) {
  const reference = error?.digest && /^[a-z0-9-]{1,80}$/i.test(error.digest) ? error.digest : '';
  return <main data-storefront-state="error" role="alert" style={{padding:'64px 24px',textAlign:'center'}}>
    <h1 style={{fontSize:22,fontWeight:700}}>화면을 불러오지 못했습니다</h1>
    <p style={{marginTop:16}}>잠시 후 다시 확인해주세요. 결제·취소 처리 중이었다면 주문 내역을 먼저 확인해주세요.</p>
    <p style={{marginTop:12,fontSize:13,color:'#666'}}>오류 PAGE_LOAD_ERROR{reference ? ` · 문의번호 ${reference}` : ''}</p>
    <button onClick={unstable_retry} style={{marginTop:24,padding:'10px 20px',border:'1px solid #bbb',borderRadius:8}}>화면 다시 불러오기</button>
    <a href="/orders/lookup" style={{display:'inline-block',marginLeft:16,textDecoration:'underline'}}>주문 내역 확인</a>
  </main>;
}
