# 공동구매 검색 노출 운영 가이드 (2026-10-30)

## 자동 적용
- 블랜드픽: 공동구매 쇼핑·숙박을 핵심 검색 의도로 사용하며 `/group-buy`는 공동구매 뜻, 참여 방법, 실제 상품 목록 이동을 제공합니다.
- 산지픽: 농산물·수산물 공동구매를 핵심 검색 의도로 사용하며 도메인별 `/group-buy`에서 카테고리별 구매 안내를 제공합니다.
- 각 URL의 고유 title/description, canonical, 사이트맵과 내부 링크를 설정했습니다.
- `Public search visibility health check` GitHub Actions가 매주 월요일 10:15 KST에 페이지·색인 기술 조건을 점검합니다.
- 상품별 metadata/JSON-LD는 기존 로직을 유지합니다. 상품 설명·원산지·배송 데이터가 없을 때 임의로 생성하지 않습니다.

## 사용자가 관리자 계정에서 직접 처리할 항목
1. [Google Search Console](https://search.google.com/search-console/welcome)에서 `https://shop.blendpunch.com`, `https://sanjipick.blendpunch.com` 각각의 소유권 확인 및 실제 색인 상태를 확인합니다. URL 검사에서 각 `/group-buy` 주소에 대해 색인 등록을 요청합니다.
2. 두 속성에서 `https://shop.blendpunch.com/sitemap.xml` / `https://sanjipick.blendpunch.com/sitemap.xml`을 제출하고 오류를 확인합니다.
3. [네이버 서치어드바이저](https://searchadvisor.naver.com/)에서 각 도메인을 등록합니다. 네이버 소유권 확인이 필요하면 각 사이트에서 제공한 소유확인 HTML 파일 또는 메타태그를 발급받아 배포 설정에 추가해야 합니다. 인증 코드와 실제 로그인 정보는 GitHub에 공유하지 않습니다.
4. 네이버 웹마스터도구에 각각의 sitemap.xml을 제출하고 수집/색인 상태를 점검합니다.
5. 검색 유입 성과는 Search Console `실적 → 검색어`에서 공동구매 / 공동구매 사이트 / 농산물 공동구매 / 수산물 공동구매를 필터해 7일·28일 단위로 노출수, 클릭수, 클릭률, 평균 순위를 비교합니다. 사이트별 상품 상세 유입과 구매 전환 데이터도 구분합니다.

## 콘텐츠 운영 권장사항
- 검색용 페이지에만 키워드를 반복 삽입하지 않습니다. 고객 질문에 답하는 명확한 본문과 실제 상품의 원산지·규격·구성·가격·배송 정책을 유지합니다.
- 진행 상품이 추가될 때는 상품명, 상세 설명(실제 원산지/중량/옵션/보관 방법), 대표 이미지, 실제 출고 정보를 빠짐없이 입력합니다.
- 산지픽은 농산물과 수산물의 개별 키워드를, 블랜드픽은 생활용품과 숙박 공동구매를 중점으로 합니다.
- 구매·후기·배송·사업자 정보는 실제 확인된 값으로 표시합니다. 유료 광고는 광고 계정에서 별도로 설정하며 자연 검색 순위를 보장하지 않습니다.

## 검증
- Pull request CI: `node --test tests/product-seo.cjs tests/groupbuy-seo.cjs` 및 기존 회귀·생산 빌드
- 배포 후: 두 도메인의 /group-buy 및 sitemap/robots, 주간 public SEO health workflow
- 색인 반영 시점과 검색 순위는 Google/Naver의 크롤링·경쟁상황에 따라 달라지며 보장하지 않습니다.
