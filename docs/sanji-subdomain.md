# 산지픽 서브도메인 — 서버·DNS 세팅 가이드

> ✅ 2026-09-02 적용 완료 — Cloudflare A 레코드 + GitHub Actions `Sanji Subdomain (nginx)` 워크플로우(apply)로
> nginx 서버 블록·Let's Encrypt 인증서(만료 2026-12-01, 자동 갱신)까지 세팅됨.
> 다른 서브도메인을 또 붙일 땐 같은 워크플로우를 `host` 입력만 바꿔 실행하면 된다 (inspect로 먼저 확인 → apply).

코드 쪽 기초공사는 끝난 상태. 아래 3단계만 서버에서 하면 `sanji.blendpunch.com`이 살아난다.
(앱은 하나 — 같은 EC2, 같은 Next 프로세스가 호스트를 보고 산지픽 화면을 내보낸다.)

## 0. 구조 요약

| 구성 | 위치 | 역할 |
|---|---|---|
| `lib/sites.ts` | 사이트 설정 | 브랜드명·도메인·노출 카테고리·팔레트 |
| `proxy.ts` | Next 16 프록시 | 호스트가 산지픽이면 `/` → `/sanji` 로 내부 리라이트, `x-site` 헤더 부여 |
| `app/sanji/` | 산지픽 페이지 | 홈(`/sanji`) · 소개(`/sanji/about`) |
| `components/Header*` | 공용 헤더 | 사이트별 로고·네비 분기 |

- 산지픽 도메인에서 `/products/*`, `/cart`, `/checkout`, `/login`, `/mypage`, `/api/*`는 **블랜드픽과 공용** (헤더만 산지픽 로고).
- 산지픽에 노출할 상품 = 상품 관리에서 **카테고리 `산지픽`** 으로 지정한 판매 중 상품.
- 로컬 확인: `http://localhost:3000/sanji` 로 직접 열면 산지픽으로 취급된다.
  호스트 라우팅 자체는 `curl -H "Host: sanji.blendpunch.com" http://localhost:3000/` 로 확인.

## 1. DNS (도메인 관리 콘솔)

`blendpunch.com` 존에 레코드 추가:

```
타입: A        호스트: sanji     값: <EC2 퍼블릭 IP>     TTL: 300
```
(shop.blendpunch.com 이 CNAME/A 어느 쪽이든, 같은 값으로 맞추면 된다)

## 2. Nginx 서버 블록 (EC2)

기존 `shop.blendpunch.com` 블록과 같은 upstream을 보게 `server_name`만 추가하거나, 별도 블록을 둔다.

```nginx
server {
    listen 80;
    server_name sanji.blendpunch.com;

    location / {
        proxy_pass http://127.0.0.1:3000;   # blend-pick 서비스 포트에 맞출 것
        proxy_http_version 1.1;
        proxy_set_header Host $host;        # ★ 중요 — 앱이 이 Host로 산지픽을 판별
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 3. HTTPS (certbot)

```bash
sudo certbot --nginx -d sanji.blendpunch.com
```
(기존 인증서에 도메인을 추가해도 되고, 따로 발급해도 된다. 갱신은 기존 타이머가 같이 처리.)

## 4. 환경변수 (선택)

`.env` 에 없으면 기본값이 쓰인다.

```
NEXT_PUBLIC_SANJI_HOST=sanji.blendpunch.com     # 기본값 동일
NEXT_PUBLIC_SANJI_KAKAO_URL=...                  # 산지픽 전용 카카오 채널 생기면
```

## 5. 이후 작업 후보

- 주문에 사이트 태그(`orders.site`) 컬럼 추가 → 판매관리 '블랜드픽 / 산지픽' 탭 분리
- 산지픽 전용 상품 상세 톤(현재는 공용 상세 페이지 + 산지픽 헤더)
- `robots.txt` / `sitemap.xml` 호스트별 분기, 네이버·구글 서치콘솔에 서브도메인 별도 등록
- 토스페이먼츠 상점 설정에 `sanji.blendpunch.com` 도메인 추가 (결제창 허용 도메인)
