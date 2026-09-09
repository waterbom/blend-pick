# 배송 흐름 수정 및 검증 — 2026-09-09

기준 운영 커밋: 42d0225. 이 수정은 로컬 검토본이며 배포하지 않음.

- 송장번호는 숫자 또는 숫자 사이 하이픈만 허용하고, 서버에서 택배사 누락/코드 형식 오류를 차단.
- 배송완료 주문은 행 잠금 후 기존 송장과 비교. 동일 송장 재업로드는 허용하고 변경은 실패 사유로 반환.
- 실제 XLSX 파서를 공유 함수로 분리. 텍스트 번호와 명시적인 0 채움 서식 보존. 소수/음수/15자리 초과 숫자 셀은 원본 텍스트 재입력을 안내.
- 회귀 테스트 52개 통과. 신규 배송 시나리오 9개 통과. 중복 실행은 합산하지 않음.
- 새 시나리오에는 엑셀 읽기, 송장 저장, 주문 API 응답, 화면 HTML 렌더링, 조회 링크, 중복 문자/정산 방지, 타 사이트/취소 주문 차단을 포함.
- TypeScript 검사와 git diff --check 통과.
- 기존 admin-site 테스트 파일의 오래된 DB 스키마는 이번 변경 대상에서 제외. 배송 사이트 분리 조건은 신규 테스트 S1으로 검증.
- 실제 택배사 송장 발급/집하 조회, 문자 발송, 운영 DB 쓰기는 실행하지 않음. 실제 택배사 양식은 미제공 상태이며 합성 XLSX로 검증.

재현: node --test --test-concurrency=1 tests/shipping-simulation.cjs tests/shipping-flow.cjs tests/shipping-fees.cjs tests/admin-final-process.cjs tests/admin-integrity.cjs tests/today-work.cjs
