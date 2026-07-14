/**
 * 택배사 코드 단일 소스 — 스위트트래커(스마트택배) 숫자 코드 기준.
 *
 * 원칙: DB(orders.tracking_company)에는 항상 숫자 코드("04")를 저장한다.
 * 전체 택배사 목록은 스위트트래커 companylist API(/api/admin/shipments/carriers)에서
 * 실시간으로 받아오고, 여기의 CORE_CARRIERS는 API 키가 없을 때의 폴백이자
 * 국내 주요 6사(교차 검증된 코드)만 담는다. 그 외 코드는 하드코딩하지 않는다.
 *
 * 과거 주문 호환: 예전 개별 운송장 폼이 "cj"/"hanjin" 같은 텍스트 코드를 저장했으므로
 * LEGACY_TEXT_TO_CODE 로 읽기 시점에 변환한다.
 */

export const CORE_CARRIERS: { code: string; name: string }[] = [
  { code: "04", name: "CJ대한통운" },
  { code: "05", name: "한진택배" },
  { code: "08", name: "롯데택배" },
  { code: "01", name: "우체국택배" },
  { code: "06", name: "로젠택배" },
  { code: "23", name: "경동택배" },
];

export const LEGACY_TEXT_TO_CODE: Record<string, string> = {
  cj: "04",
  hanjin: "05",
  lotte: "08",
  post: "01",
  logen: "06",
};

const LEGACY_NAMES: Record<string, string> = {
  ems: "EMS",
  dhl: "DHL",
  fedex: "FedEx",
  etc: "기타",
};

/** 저장값(숫자 코드 또는 레거시 텍스트) → 숫자 코드. 변환 불가면 null */
export function toCarrierCode(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (/^\d{1,3}$/.test(stored)) return stored;
  return LEGACY_TEXT_TO_CODE[stored.toLowerCase()] ?? null;
}

/** 저장값 → 표시용 택배사 이름 */
export function carrierName(stored: string | null | undefined): string {
  if (!stored) return "택배";
  const code = toCarrierCode(stored);
  const core = code && CORE_CARRIERS.find((c) => c.code === code);
  if (core) return core.name;
  return LEGACY_NAMES[stored.toLowerCase()] ?? stored;
}

// 주요 택배사 공식 조회 URL (숫자 코드 기준)
const TRACKING_URL_BY_CODE: Record<string, (n: string) => string> = {
  "04": (n) => `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${n}`,
  "05": (n) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KOR&wblnumText2=${n}`,
  "08": (n) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`,
  "01": (n) => `https://service.epost.go.kr/trace.RetrieveDomRqst.comm?sid1=${n}`,
  "06": (n) => `https://www.ilogen.com/m/personal/trace/${n}`,
};

/** 저장값 + 운송장번호 → 손님용 조회 링크. 모르는 택배사는 네이버 조회로 폴백 */
export function trackingUrl(stored: string | null | undefined, invoice: string): string {
  const code = toCarrierCode(stored);
  if (code && TRACKING_URL_BY_CODE[code]) return TRACKING_URL_BY_CODE[code](invoice);
  const q = encodeURIComponent(`${carrierName(stored)} 운송장 조회 ${invoice}`);
  return `https://search.naver.com/search.naver?query=${q}`;
}
