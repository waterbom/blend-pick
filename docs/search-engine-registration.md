# 검색엔진 등록 (구글 서치콘솔 · 네이버 서치어드바이저)

대상 사이트 2개 — 각각 따로 등록한다.

| 사이트 | 주소 | robots | sitemap |
|---|---|---|---|
| 블랜드픽 | https://shop.blendpunch.com | /robots.txt (app/robots.ts) | /sitemap.xml (app/sitemap.ts — 산지픽 카테고리 제외) |
| 산지픽 | https://sanjipick.blendpunch.com | /robots.txt (app/sanji/robots.txt/route.ts) | /sitemap.xml (app/sanji/sitemap.ts — 산지픽 상품 /p/<id>) |

shop 도메인의 `/sanji/*` 미리보기는 `noindex` + canonical(sanjipick 도메인)이라 중복 색인이 되지 않는다.

## 소유 확인 코드 넣는 곳

구글·네이버 모두 "HTML 태그" 방식을 쓴다. 발급받은 `content="..."` 값을 `lib/sites.ts` 의 `verification` 에 넣고 배포하면
`<head>` 에 meta 태그가 실린다.

```ts
// lib/sites.ts
blendpick: { ..., verification: { google: ["구글코드"], naver: ["네이버코드"] } },
sanjipick: { ..., verification: { google: ["구글코드"], naver: ["네이버코드"] } },
```

- 구글: `<meta name="google-site-verification" content="여기">` 의 content 값
- 네이버: `<meta name="naver-site-verification" content="여기">` 의 content 값

## 구글 서치콘솔 — https://search.google.com/search-console

1. 속성 추가 → **URL 접두어** 선택 → `https://shop.blendpunch.com` 입력 (산지픽은 `https://sanjipick.blendpunch.com` 으로 한 번 더).
   - 도메인 속성(`blendpunch.com`)으로 하면 서브도메인이 한 번에 잡히지만 DNS TXT 레코드 등록이 필요하다. 가비아/카페24 등 DNS 관리 화면에 접근 가능하면 이쪽이 편하다.
2. 소유 확인 방법에서 **HTML 태그** → content 값을 복사해 `lib/sites.ts` 에 넣고 배포 → 서치콘솔에서 "확인".
3. 왼쪽 메뉴 **Sitemaps** → `sitemap.xml` 입력 → 제출.
4. **URL 검사**에 메인 주소를 넣고 "색인 생성 요청" 을 한 번 눌러두면 첫 수집이 빨라진다.
5. 며칠 뒤 "페이지" 메뉴에서 색인된 페이지 수를 확인.

## 네이버 서치어드바이저 — https://searchadvisor.naver.com

1. 웹마스터 도구 → **사이트 등록** → `https://shop.blendpunch.com` (산지픽도 한 번 더).
2. 소유 확인 → **HTML 태그** → content 값을 `lib/sites.ts` 에 넣고 배포 → "소유확인".
3. 사이트 선택 → **요청 → 사이트맵 제출** → `https://shop.blendpunch.com/sitemap.xml` (산지픽은 sanjipick 도메인 sitemap).
4. **요청 → RSS 제출**은 없으니 건너뛴다. **요청 → 웹 페이지 수집**에 메인 주소를 넣어 수동 수집 요청.
5. **검증 → robots.txt** 에서 수집 허용으로 나오는지 확인, **검증 → 사이트 간단 체크**도 한 번.
6. 네이버는 색인까지 보통 1~2주. 상품 페이지가 안 잡히면 "웹 페이지 수집"에 개별 URL을 넣는다.

## 등록 후 체크

- `https://<도메인>/robots.txt` 가 열리고 `Sitemap:` 줄이 있는지
- `https://<도메인>/sitemap.xml` 에 상품 URL이 나오는지 (상품이 판매중 상태여야 포함)
- 구글: `site:sanjipick.blendpunch.com` 검색으로 색인 여부 확인
