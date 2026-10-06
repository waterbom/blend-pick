// 관리자·파트너 업무와 결제 화면에서는 고객용 플로팅 도구가 작업을 가리지 않도록 숨긴다.
// 서버 첫 응답과 클라이언트 화면 전환에 같은 조건을 적용한다.
export function isFloatingExcludedPath(pathname: string): boolean {
  return /^\/(?:admin|partners|influencer|sanji|pay)(?:\/|$)/.test(pathname)
    || /^\/hotel\/dangung(?:\/|$)/.test(pathname)
    || /(?:^|\/)checkout(?:\/|$)/.test(pathname);
}
