# 학습노트 — 판매관리 & 정산관리 페이지 구현
# 작성일: 2026-05-13

# ──────────────────────────────────────────────────────────────
# 1. 페이지 구조 설계 원칙
# ──────────────────────────────────────────────────────────────
#
# blend-pick admin은 Next.js App Router 기반.
# app/admin/(protected)/ 하위의 모든 페이지는 layout.tsx에서
# admin_token 쿠키를 검증한 뒤에만 접근 가능하다.
#
# 서버 컴포넌트 (page.tsx) → DB 직접 쿼리
# 클라이언트 컴포넌트 (components/admin/*.tsx) → 사용자 인터랙션 처리
#
# ★ 핵심 패턴: 서버 컴포넌트 + 클라이언트 컴포넌트 분리
#   - 데이터 조회는 page.tsx에서 async/await로 처리
#   - 버튼 클릭, 상태 변경 등 이벤트는 "use client" 컴포넌트로 분리
#   - 클라이언트 컴포넌트는 서버 컴포넌트 안에 props로 주입


# ──────────────────────────────────────────────────────────────
# 2. searchParams — URL 쿼리 파라미터로 필터링
# ──────────────────────────────────────────────────────────────
#
# Next.js App Router에서 searchParams는 Promise 타입이다.
# (Next.js 15부터 비동기로 바뀜)
#
# 올바른 사용법:
#   export default async function Page({
#     searchParams,
#   }: {
#     searchParams: Promise<{ status?: string }>;
#   }) {
#     const { status } = await searchParams;  # ← await 필수!
#
# 잘못된 사용법 (Next.js 14 이하 방식):
#   export default function Page({ searchParams }: { searchParams: { status?: string } }) {
#     const { status } = searchParams;  # ← Next.js 15에서 에러 발생


# ──────────────────────────────────────────────────────────────
# 3. 대시보드 카드 UI 패턴
# ──────────────────────────────────────────────────────────────
#
# 판매관리/정산관리 상단에 주요 지표를 흐름 카드로 표시.
# 각 카드를 클릭하면 해당 상태로 필터링된 목록을 보여준다.
#
# 구조:
#   신규주문 › 배송준비 › 배송중 › 배송완료
#
# SQL 집계 패턴 (FILTER 사용):
#   SELECT
#     COUNT(*) FILTER (WHERE status = 'paid')      AS new_orders,
#     COUNT(*) FILTER (WHERE status = 'preparing') AS preparing,
#     ...
#   FROM orders
#
# ★ FILTER 절은 WHERE 없이 여러 조건을 한 번의 쿼리로 집계할 수 있어 효율적.
#   GROUP BY 없이 단일 행으로 여러 카운트를 반환한다.


# ──────────────────────────────────────────────────────────────
# 4. 정산(Settlement) 설계 — 배송완료 시점 자동 생성
# ──────────────────────────────────────────────────────────────
#
# 정산 시점 선택지:
#   A. 결제 완료 시점  → 주문 들어오자마자 생성 (단순하지만 취소/환불 처리 복잡)
#   B. 배송완료 시점   → 구매 확정 후 생성 (쿠팡/네이버 방식, 이 프로젝트 선택)
#
# 토스페이먼츠 수수료 기준:
#   - 카드:     3.3% + VAT(10%) = 3.63%
#   - 계좌이체: 1.5% + VAT(10%) = 1.65%
#
# 수수료 계산:
#   fee = Math.round(gross_amount * rate)  # 소수점 반올림
#   net_amount = gross_amount - fee


# ──────────────────────────────────────────────────────────────
# 5. API Route에서 트랜잭션 처리
# ──────────────────────────────────────────────────────────────
#
# orders 상태 변경 + settlements INSERT는 하나의 트랜잭션으로 묶어야 한다.
# 하나라도 실패하면 둘 다 롤백 → 데이터 불일치 방지.
#
# pool.connect() → client 사용:
#   const client = await shopPool.connect();
#   try {
#     await client.query("BEGIN");
#     await client.query("UPDATE orders ...");
#     await client.query("INSERT INTO settlements ...");
#     await client.query("COMMIT");
#   } catch (e) {
#     await client.query("ROLLBACK");
#   } finally {
#     client.release();  # ← 반드시 반납! 안 하면 커넥션 풀 고갈
#   }
#
# ★ pool.query()는 자동으로 연결/해제하지만 트랜잭션 불가.
#   트랜잭션이 필요하면 반드시 pool.connect()로 client를 직접 관리해야 한다.


# ──────────────────────────────────────────────────────────────
# 6. 중복 정산 방지 패턴
# ──────────────────────────────────────────────────────────────
#
# 배송완료 API가 두 번 호출되면 settlements가 두 번 생성될 수 있다.
# 방어 코드:
#   const existing = await client.query(
#     `SELECT id FROM settlements WHERE order_id = $1`, [id]
#   );
#   if (existing.rows.length === 0) {
#     // INSERT 실행
#   }
#
# 기존 더미 데이터(API 거치지 않고 직접 INSERT된 delivered 주문)는
# settlements가 없으므로 별도 SQL로 일괄 생성:
#   INSERT INTO settlements (...)
#   SELECT ... FROM orders
#   WHERE status = 'delivered'
#     AND id NOT IN (SELECT order_id FROM settlements WHERE order_id IS NOT NULL);
#
# ★ NOT IN으로 이미 정산된 주문은 건너뜀 → 멱등성(idempotency) 보장


# ──────────────────────────────────────────────────────────────
# 7. router.refresh() — 서버 컴포넌트 데이터 갱신
# ──────────────────────────────────────────────────────────────
#
# 클라이언트 컴포넌트에서 API 호출 후 목록을 최신화하려면
# router.refresh()를 사용한다.
#
# import { useRouter } from "next/navigation";
# const router = useRouter();
# // API 성공 후
# router.refresh();  # 현재 페이지의 서버 컴포넌트 데이터만 재조회 (전체 리로드 X)
#
# ★ window.location.reload()와 달리 클라이언트 상태(스크롤 위치 등)를 유지하면서
#   서버에서 최신 데이터만 다시 가져온다.


# ──────────────────────────────────────────────────────────────
# 8. 정산 집계 쿼리 — 기간별 SUM + FILTER
# ─────────────────────────────────────────────────────────���────
#
# 오늘/이번 주/이번 달 정산액을 한 번의 쿼리로:
#   SELECT
#     SUM(net_amount) FILTER (
#       WHERE settled_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
#     ) AS today,
#     SUM(net_amount) FILTER (
#       WHERE settled_at >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')
#     ) AS this_week,
#     SUM(net_amount) FILTER (
#       WHERE settled_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')
#     ) AS this_month
#   FROM settlements
#
# ★ date_trunc('week', ...) → 이번 주 월요일 00:00:00
#   date_trunc('month', ...) → 이번 달 1일 00:00:00
#   한국 시간(Asia/Seoul) 기준으로 변환 필수 (UTC 기본값은 9시간 차이)
