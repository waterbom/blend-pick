# 오류 응답과 진단

API 실패 응답에는 기존 `error` 문자열과 함께 `code`, `requestId`, `action`, `retryable: false`가 포함된다. 문의번호는 서버에서 생성하고 `X-Request-ID` 헤더 및 `api_error` JSON 로그와 일치시킨다. 성공 응답, 쿠키, 리다이렉트, 파일 다운로드와 일괄 작업의 성공·실패 건수 계약은 유지한다.

새 API도 `withApiErrors('POST /api/example', handler)`로 내보내고 JSON 본문은 `readJsonObject(request)`로 읽는다. 기본 상한은 실제 수신 바이트 기준 2 MiB다. 본문 없는 요청을 허용하는 작업은 그 경우만 명시적으로 분기한다. 입력값 자체와 소유권·사이트·현재 상태는 업무 함수에서 검증한다.

예상되는 업무 오류는 `ApiError(code, 안전한 안내문, status)`를 사용한다. 기존 catch가 응답을 반환해야 하면 `apiErrorResponse(error)`를 사용하고, 원본 예외를 삼키거나 `error.message`를 직접 반환하지 않는다. 트랜잭션 실패 시 `rollbackSafely`를 사용해 롤백 오류가 최초 원인을 덮지 않도록 한다. 반환값이 false면 롤백 완료로 표시하지 않는다.

| 코드 | 의미와 처리 |
| --- | --- |
| INVALID_JSON / INVALID_BODY / INVALID_INPUT | 입력 형식·값 수정 |
| REQUEST_TOO_LARGE | 요청 크기를 줄여 재시도 |
| AUTH_REQUIRED / FORBIDDEN | 인증·권한 확인 |
| STATE_CONFLICT / DUPLICATE_DATA / REFUND_IN_PROGRESS | 현재 상태·기존 처리 결과 확인 |
| DB_BUSY / DB_UNAVAILABLE / DB_SCHEMA_MISMATCH | 동시 처리·연결·서버 데이터 구조 점검 |
| UPSTREAM_TIMEOUT / UPSTREAM_INVALID_RESPONSE | 외부 결과를 확인한 뒤 대응 |
| PAYMENT_REVIEW_REQUIRED / REFUND_REVIEW_REQUIRED | 기존 결제·환불 조회와 복구 사용 |
| INTERNAL_ERROR | 문의번호로 로그의 발생 위치 확인 |
| PAGE_LOAD_ERROR | 화면의 문의번호를 서버 로그 renderDigest와 대조 |

로그에는 분류된 원인, 허용된 DB·네트워크 원인 코드, 코드 위치만 남긴다. 요청 본문, URL 쿼리, 고객 연락처, 결제키, 인증 쿠키, SQL 원문·파라미터, 외부 응답 원문을 기록하지 않는다. 원인을 분류할 수 없으면 INTERNAL_ERROR로 남겨 추측한 원인을 안내하지 않는다.

결제·환불·발주 등 쓰기 요청은 이 계층에서 자동 재시도하지 않는다. 서버의 기존 멱등성·상태 확인 절차를 통한다. 결제·환불 확인 기록의 last_error에도 코드와 문의번호를 보관한다. 고객 화면은 `apiErrorMessage`로 원인과 문의번호를 함께 표시한다. 결제 성공 후 브라우저 저장소 정리 실패는 결제 실패로 처리하지 않는다.

배송조회 API·택배사 조회·자동 조회 작업은 이번 변경에서 제외했다.

검증: `npm run test:process-edges`, `npm run test:buyer`, `npm run test:admin-integrity`, `npm run test:tracking-import`, 프로덕션 빌드. 테스트는 외부 결제·문자 서비스를 모의 처리하고 격리된 DB를 사용한다.
