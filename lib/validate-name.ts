/**
 * 구매자/예약자 이름 검증 — 결제창 열기 전에 호출.
 * 통과: 완성형 한글 2~20자("홍길동") 또는 영문 이름 2자 이상(공백 포함 최대 5단어, "John Smith")
 * 차단: 자음/모음만("ㅋㅋ","ㅁㄴㅇ"), 숫자·특수문자·이모지 포함, 1글자, 공백만
 * @returns 통과 시 null, 실패 시 사용자에게 보여줄 안내 문구
 */
export function validateBuyerName(raw: string): string | null {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) return "이름을 2자 이상 정확히 입력해주세요.";
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(name)) return "이름을 정확히 입력해주세요. (자음·모음만 입력할 수 없어요)";
  const korean = /^[가-힣]{2,20}$/;
  const english = /^[A-Za-z]{2,20}( [A-Za-z]{1,20}){0,4}$/;
  if (korean.test(name) || english.test(name)) return null;
  return "이름은 한글 또는 영문만 입력할 수 있어요.";
}
