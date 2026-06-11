# Blend Pick 개발 노트 — 2026년 6월

## 프로젝트 개요

**두 개의 분리된 DB 아키텍처**

| 변수 | DB명 | 역할 |
|------|------|------|
| `pool` (lib/db.ts) | `blendpunch_dev` (RDS) | OS DB — campaigns, products(OS), influencers, sales_pages, shop_users |
| `shopPool` (lib/db-shop.ts) | `blendpunch_shop` (RDS) | Shop DB — products_shop, orders, order_items, admin_users, settlements |

- RDS 엔드포인트: `blendpunch-db.ctikyeuwquey.ap-northeast-2.rds.amazonaws.com:5432`
- 두 DB 모두 같은 RDS 인스턴스, 다른 데이터베이스명

---

## 1. 관리자 로그인 개선

### 문제
- `/admin/login` 전용 페이지가 따로 존재 → 일반 유저와 로그인 경험 분리
- 어드민 로그인 후 `router.push("/")` 시 Next.js App Router의 **라우터 캐시**가 이전 렌더(로그인 전) 상태를 재사용 → 헤더가 "로그인" 그대로 표시되는 버그

### 해결

**1) `/admin/login` 페이지 삭제**
```bash
rm -rf app/admin/login
```

**2) middleware.ts — 리다이렉트 대상 변경**
```ts
// 변경 전
return NextResponse.redirect(new URL("/admin/login", req.url));
// 변경 후
return NextResponse.redirect(new URL("/login", req.url));
```

**3) `/admin/login` 참조 전체 제거**
- `app/admin/(protected)/layout.tsx` — redirect("/login")
- `app/admin/(protected)/orders/[id]/page.tsx` — redirect("/login")

**4) 로그인 후 하드 리다이렉트 (캐시 우회)**
```ts
// login/page.tsx — 변경 전 (Next.js 라우터 캐시 문제)
router.push(data.redirect || "/");

// 변경 후 (전체 페이지 새로고침 → 쿠키 항상 새로 읽음)
window.location.href = data.redirect || "/";
```

**5) Header.tsx — admin_token 쿠키 감지 추가**
```ts
// admin_token 우선 확인 후 일반 shop_token 확인
const adminToken = cookieStore.get("admin_token")?.value;
if (adminToken) {
  const adminPayload = await verifyAdminToken(adminToken);
  if (adminPayload) {
    user = { nickname: adminPayload.name, name: adminPayload.name, profile_image: null };
    isAdmin = true;
  }
}
```

**6) HeaderClient.tsx — 관리자모드 UI**
- isAdmin=true 일 때: 주황 "관리자모드" 배지 + "관리자마이페이지" 링크 표시
- 장바구니 버튼은 관리자에겐 숨김

### 결과 흐름
`/login` → `admin@blendpick.com` 입력 → `admin_token` 쿠키 발급 → 홈(`/`)으로 하드 리다이렉트 → 헤더에 "관리자모드" 배지 표시 → "관리자마이페이지" 클릭 → `/admin` 진입

---

## 2. 카테고리 관리 시스템

### DB
```sql
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API
- `GET /api/admin/categories` — 목록 조회 (테이블 없으면 자동 생성)
- `POST /api/admin/categories` — 추가 (중복 시 409)
- `DELETE /api/admin/categories/[id]` — 삭제

### 적용
- 상품 등록/수정 페이지의 카테고리 `<input>` → `<select>`로 변경
- 상품 목록 오른쪽 상단에 "카테고리 관리" 버튼 추가

---

## 3. 상품 등록/수정 페이지 전면 개편

### 이미지 구조 변경
- 기존: 대표 이미지 URL 입력 1개
- 변경: 이미지 목록 통합 — **첫 번째가 자동으로 대표 이미지**
  - `images[0]` → `products_shop.main_image`
  - `images[1+]` → `product_images` 테이블
- `대표` 배지로 첫 번째 이미지 명시

### 파일 업로드 기능 추가
```
app/api/admin/upload/route.ts
```
- `POST /api/admin/upload` — multipart 파일 수신 → `public/uploads/` 저장
- 허용: jpg, png, webp, gif
- 파일명: UUID 기반 (`${randomUUID()}.${ext}`)
- 반환: `{ url: "/uploads/filename" }`
- 각 이미지 행에 "파일" 버튼 → 클릭 시 hidden file input 트리거 → 업로드 → URL 자동 입력

> **EC2 주의**: 배포 후 `mkdir -p ~/blend-pick/public/uploads` 실행 필요

### 가격 자동 계산
```
소비자가(정가) + 할인율(%) → 판매가 자동 계산
판매가 = round(소비자가 × (1 - 할인율/100))
절약금액 = 소비자가 - 판매가 (표시용)
```
```ts
function handleDiscountRate(val: string) {
  const orig = parseFloat(form.original_price);
  const rate = parseFloat(val);
  const newPrice = !isNaN(orig) && !isNaN(rate) && rate >= 0 && rate <= 100
    ? String(Math.round(orig * (1 - rate / 100))) : form.price;
  setForm(f => ({ ...f, discount_rate: val, price: newPrice }));
}
```

### 옵션 동적 입력
- 옵션명 / 가격(원) / 재고 — 행 단위 추가/삭제
- 저장 시 `product_options` 테이블에 INSERT (name=value로 저장)

### 배송 타입 3종
| 값 | 표시 | 추가 입력 |
|----|------|-----------|
| `free` | 무료배송 | 없음 |
| `paid` | 유료배송 | 배송비 |
| `conditional_free` | 조건부무료 | 배송비 + 기준금액 |

```sql
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS free_shipping_threshold INTEGER;
```

### 상세페이지 HTML
- `<textarea>` — HTML 직접 붙여넣기 가능
- `description` 컬럼에 저장
- 고객 페이지에서 `dangerouslySetInnerHTML`로 렌더링

---

## 4. 상품 코드 (product_code) 시스템

### DB
```sql
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS product_code VARCHAR(20) UNIQUE;
```

### 채번 방식 — `P001`, `P002`, ...
```ts
// 신규 등록 시 자동 채번
const codeResult = await client.query(
  `SELECT COALESCE(MAX(CAST(SUBSTRING(product_code FROM 2) AS INTEGER)), 0) + 1 AS next_num
   FROM products_shop WHERE product_code ~ '^P[0-9]+$'`
);
const nextCode = "P" + String(codeResult.rows[0].next_num).padStart(3, "0");
```

### UI
- 상품 목록에 "코드" 컬럼 추가
- `ProductCodeCopy` 클라이언트 컴포넌트 — 클릭 시 클립보드 복사, 1.5초간 초록색 체크 표시

---

## 5. 판매관리(주문) 발주 자동화

### DB 추가 컬럼
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS option_label VARCHAR(200);
```

### 결제 저장 수정 (shop-confirm route)
기존에 저장되지 않던 필드 추가:
- `recipient_name`, `recipient_phone` (배송지 수령인)
- `addr_memo` (배송 메모)
- `order_items.option_label` (옵션 텍스트)

```ts
// ShopCheckoutClient — optionLabel을 checkoutData에 포함
const checkoutData = {
  ...
  optionLabel: optionLabel || null,
};
```

### 주문 목록 API
```
GET  /api/admin/orders          — 발주용 전체 필드 조회 (product_code 포함)
PATCH /api/admin/orders         — 선택 주문들 → status: 'preparing' 일괄 변경
```

### 관리자 주문 페이지 (OrdersClient)
- **상품명 기준 그룹핑** — 접기/펼치기
- **체크박스** — 개별/그룹/전체 선택
- **일괄 발주처리 버튼** → CSV 다운로드 + 상태 변경

### 발주 엑셀 표준 컬럼 (CSV)
```
판매처 / 상품코드 / 상품명 / 주문번호 / 주문자명 / 주문자연락처 / 주문일시
수령인명 / 수령인연락처 / 우편번호 / 수령인주소 / 고객선택옵션 / 주문수량 / 배송요청사항
택배사 / 배송번호
```
- UTF-8 BOM (`﻿`) 포함 — 한국어 엑셀 깨짐 방지
- 발주처리 시 status: `paid` → `preparing` 자동 변경

---

## 6. 이미지 Fallback 처리

### 문제
- Unsplash 등 외부 이미지 URL 깨질 때 alt 텍스트가 노출되거나 빈 영역 표시

### 해결 — FallbackImg 클라이언트 컴포넌트
```tsx
// components/FallbackImg.tsx
export default function FallbackImg({ src, alt, className, fallbackText = "이미지 없음" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div>이미지 아이콘 + fallbackText</div>;
  }
  return <img src={src} onError={() => setFailed(true)} ... />;
}
```

### 적용 컴포넌트
- `ProductCard.tsx`
- `SalesPageCard.tsx`
- `HomeDealSection.tsx`
- `CollabSection.tsx`
- `SalesBanner.tsx`
- `ProductDetail.tsx`
- `app/products/page.tsx`
- `InquiryButton.tsx` (최근 본 상품 — 3곳)

---

## 7. 고객 상품 상세 페이지 이미지 구조 변경

### 변경 전
- 이미지 carousel (썸네일 클릭으로 교체)

### 변경 후
- 대표 이미지(images[0]) → 상단 2열 그리드 좌측에 단일 표시
- 추가 이미지(images[1+]) → 상세 설명 위에 세로로 쭉 나열
- description → `dangerouslySetInnerHTML`로 HTML 렌더링

---

## 8. DB 마이그레이션 전체 목록

```sql
-- products_shop
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS free_shipping_threshold INTEGER;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS product_code VARCHAR(20) UNIQUE;

-- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

-- order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS option_label VARCHAR(200);

-- product_categories (신규)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. 파일 구조 변경 요약

### 신규 생성
```
app/api/admin/upload/route.ts           — 이미지 파일 업로드
app/api/admin/categories/route.ts       — 카테고리 CRUD
app/api/admin/categories/[id]/route.ts  — 카테고리 삭제
app/api/admin/orders/route.ts           — 주문 목록 + 일괄 발주처리
app/admin/(protected)/categories/page.tsx — 카테고리 관리 페이지
components/FallbackImg.tsx              — 이미지 fallback
components/admin/OrdersClient.tsx       — 주문 목록 클라이언트 컴포넌트
components/admin/ProductCodeCopy.tsx    — product_code 복사 버튼
public/uploads/                         — 업로드 이미지 저장 디렉토리
```

### 대폭 수정
```
app/admin/(protected)/products/new/page.tsx  — 이미지/가격/옵션/배송 전면 개편
app/admin/(protected)/products/[id]/page.tsx — 동일
app/admin/(protected)/orders/page.tsx        — OrdersClient로 교체
app/api/admin/products/route.ts              — product_code 채번, extra_images, options
app/api/admin/products/[id]/route.ts         — GET에 extra_images/options 포함
app/api/payment/shop-confirm/route.ts        — recipient, option_label, addr_memo 저장
components/Header.tsx                         — admin_token 감지
components/HeaderClient.tsx                   — 관리자모드 UI
components/ProductDetail.tsx                  — 이미지 세로 정렬, HTML 렌더링
components/ShopCheckoutClient.tsx             — optionLabel 포함
middleware.ts                                 — /login으로 리다이렉트
app/login/page.tsx                            — window.location.href 하드 리다이렉트
```

### 삭제
```
app/admin/login/  — 전용 관리자 로그인 페이지 삭제
```

---

## 10. 더미 데이터

### 카테고리 (5개)
식품, 뷰티, 생활용품, 패션, 디지털

### 상품 (8개)
| 코드 | 상품명 | 카테고리 | 가격 | 배송 | 옵션 |
|------|--------|----------|------|------|------|
| P001 | 유기농 비타민C 1000mg | 식품 | 18,900 | 무료 | 없음 |
| P002 | 딥 수분 크림 세트 | 뷰티 | 34,000 | 조건부(3만) | 용량 2종 |
| P003 | 미니 에어프라이어 3.5L | 생활용품 | 59,000 | 조건부(5만) | 컬러 2종 |
| P004 | 오버핏 반팔 티셔츠 | 패션 | 22,000 | 유료(3,000) | 색상+사이즈 6종 |
| P005 | ANC 무선 이어폰 | 디지털 | 79,000 | 무료 | 컬러 2종 |
| P006 | 유기농 그래놀라 500g | 식품 | 12,900 | 조건부(2.5만) | 없음 |
| P007 | 히알루론산 앰플 30ml | 뷰티 | 28,000 | 무료 | 없음 |
| P008 | 스텐 보온 텀블러 | 생활용품 | 19,800 | 유료(3,000) | 컬러 3종 |

### 주문 (15건)
- 신규(paid) 5건 / 배송준비(preparing) 4건 / 배송중(shipped) 3건 / 배송완료(delivered) 3건
- 실제 한국 주소, 이름, 연락처 형식 사용

### 정산 (6건)
- shipped/delivered 주문 대상
- PG 수수료 3.3% 차감 계산
- `settlements` 테이블에 gross_amount, fee, net_amount 저장

---

## 11. 트러블슈팅 기록

### Next.js App Router 라우터 캐시 문제
- **증상**: 로그인 후 `router.push("/")` 시 헤더가 갱신 안 됨
- **원인**: App Router의 클라이언트 사이드 네비게이션이 이전 서버 컴포넌트 렌더 캐시 재사용
- **해결**: `window.location.href` 하드 리다이렉트로 전체 페이지 새로고침

### zsh glob 이슈
- **증상**: `git add app/campaigns/[id]/page.tsx` 실패
- **원인**: zsh가 `[id]`를 glob 패턴으로 해석
- **해결**: `git add "app/campaigns/[id]/page.tsx"` (따옴표)

### settlements FK 제약
- **증상**: orders DELETE 시 `settlements_order_id_fkey` 위반
- **원인**: settlements 테이블이 orders.id를 참조
- **해결**: settlements 먼저 DELETE 후 orders 삭제

### TypeScript unused import 패턴
- import 추가와 실제 사용 교체를 분리하면 `선언되었지만 사용되지 않음` 경고
- **해결**: import 추가와 img 교체를 한 Edit 호출로 묶어서 처리

---

## 12. 실무 규칙 / 주의사항

- **커밋 메시지에 Co-Authored-By 절대 금지** (피드백 메모리 참조)
- **EC2 배포 후 필수 실행**: `mkdir -p ~/blend-pick/public/uploads`
- **새 상품 등록** → product_code 자동 채번 (P001~, DB 트랜잭션 내 처리)
- **발주 엑셀 CSV** — 반드시 UTF-8 BOM 포함해야 한국어 깨지지 않음
- **배송 타입** — `conditional_free` 추가 시 `free_shipping_threshold` 컬럼 필수
- **admin_token vs shop_token** — 두 쿠키가 독립적으로 관리됨, 어드민은 shop_token 없어도 됨
