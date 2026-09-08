# 자동 점검에 트래픽 집계 추가 — 배포 대기 검토본

## 이번 구현

- `ops/nginx/traffic-log.conf.example`: 사이트·요청 유형만 남기는 JSONL 로그 설정 예시. 자동 설치 안 함.
- `scripts/collect-traffic.cjs`: 지정된 로컬 로그 파일을 기간별 집계. 읽기 전용, 원본 내용 출력 안 함.
- `scripts/traffic/aggregate.cjs`: 사이트/시간/페이지 유형별 요청 수, 보낸/받은 바이트, HTML 문서 응답, 4xx/5xx, 처리 시간, 봇/점검 분류 합계.
- `scripts/check-storefront.cjs --traffic-summary JSON`: 기존 점검의 HTML/JSON/Markdown에 집계 포함. 예시와 실측을 혼합하면 실패.
- 화면에 방문자·세션·실제 PV는 별도 수집 필요라고 표시. MetaPixel은 기존 그대로 유지.

## 예시 생성

```bash
node scripts/collect-traffic.cjs --example --output monitor-example/traffic.json
node scripts/check-storefront.cjs --example --traffic-summary monitor-example/traffic.json --output-dir monitor-example/combined
```

## 로컬 로그 집계

```bash
node scripts/collect-traffic.cjs --input /path/to/traffic.jsonl --from 2026-09-08T00:00:00+09:00 --to 2026-09-09T00:00:00+09:00 --output monitor-output/traffic.json
```

최대 31일, 시작 포함·종료 제외. 여러 `--input` 지원. 같은 파일(inode) 중복 거부. 서로 내용이 겹치는 복사본은 자동 판별하지 않으므로 비중복 로그 조각만 전달한다. gzip 파일은 직접 지원하지 않는다. 같은 기간을 다시 집계하면 해당 출력 파일을 교체하고 기존 합계에 더하지 않는다.

유효하지 않은 행·알 수 없는 사이트가 있으면 품질 건수를 남기고 종료 코드 1. 파일/인자 오류는 2, 정상 처리는 0. 빈 로그는 방문자 0명이나 수집 정상으로 판정하지 않는다. 누락된 시간은 0으로 채우지 않는다. 입력 로그 기간 완전성은 항상 `unverified`로 표시한다.

## 계산 기준

| 지표 | 계산 |
|---|---|
| 전체 요청 | 유효 로그 행 수. 봇·모니터·관리자·오류·이미지·API 포함 |
| 보낸 바이트 | `$bytes_sent` 합계 |
| 받은 바이트 | `$request_length` 합계 |
| 서버 오류율 | 5xx / 전체 요청 × 100, 분모 0이면 null |
| 평균 처리 시간 | `$request_time` 합계 / 전체 요청 |
| 느린 요청 | 처리 시간 3초 이상 |
| HTML 문서 응답 | 분류 other, GET 200, text/html, prefetch 제외, 관리자·API·assets 제외 |
| 식별된 봇·모니터 | User-Agent 패턴 분류. 원문 UA 저장 안 함. 위조/미식별 봇은 구분 불가 |

Nginx 변수 기준: https://nginx.org/en/docs/http/ngx_http_log_module.html
map 기준: https://nginx.org/en/docs/http/ngx_http_map_module.html

이 값은 원본 서버에서 관측한 HTTP 요청 기준이다. 실제 페이지 조회·고유 방문자·세션·광고 유입·구매 전환·전체 CDN 전송량·네트워크 계층 전체 바이트·청구 요금과 동일하지 않다. 브라우저 라우팅·캐시 등은 별도 이벤트 계측 필요. 과거 데이터를 새 로그 없이 복원한다고 약속하지 않는다.

## 운영 연결 시 남은 작업

1. 실제 Nginx 버전과 두 사이트 server/location 구성, 기존 로그 정책 확인. 현재 환경에는 nginx가 없어 설정 검증(`nginx -t`)은 하지 못했다.
2. 사용자 배포/수집 활성화 지시에 따라 map/log_format을 http에 배치하고 대상 server에 별도 access_log 추가. 기존 access_log 유지 및 하위 location의 재정의 확인.
3. 새 로그에는 IP·쿠키·원문 UA·전체 URL·쿼리·Referer를 저장하지 않는다. 기존 로그의 개인정보 정책을 자동 변경한 것은 아니다.
4. 로그 파일 권한과 서버 사용자, logrotate(제안: 일 단위, 14일 보관, reopen 방식), 디스크 용량 확인. 실제 설정 추가는 아직 하지 않았다.
5. 서버에서 30분 단위 집계를 실행하고 집계 JSON만 기존 점검 작업에 전달할 경로 연결. 현재 자동 점검 워크플로는 서버 로그를 가져오지 않으며 트래픽 수집 스케줄도 없다.
6. 마지막 수집 시각·로그 누락·로테이션 중복 처리, 지속 저장/조회, 급증 경보는 후속이다. 이번 보고서는 지정 기간의 스냅샷이다.
7. 방문자/세션/PV 수집은 후속 검토본에 구현됨: docs/monitoring-build-review.md. 기본 비활성이며 저장소 연결·활성화는 미실행. 유입/구매 전환은 계속 별도 범위.

배포, Nginx 설정 수정·reload, 운영 로그 읽기, 외부 발송, 실제 트래픽 수집은 수행하지 않았다.
