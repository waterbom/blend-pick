-- 전시/비전시 + 비밀링크(링크가격) — Shop DB (idempotent, 배포 때마다 실행해도 안전)
--
--  products_shop.is_visible  boolean NOT NULL DEFAULT true
--    · true  = 전시 판매 상품 (메인·목록·검색·사이트맵에 노출)
--    · false = 비전시 판매 상품 (어디에도 목록 노출 없음, 상세 URL·비밀링크로만 구매)
--  products_shop.link_price  integer NULL   — 비밀링크로 들어왔을 때 적용할 판매가 (전시가와 별도)
--  products_shop.link_code   text NULL      — 비밀링크 코드 (?k=…), 상품 관리에서 발급·재발급·해제
--  orders.link_code          text NULL      — 이 주문이 어떤 비밀링크로 결제됐는지 스냅샷
SELECT pg_advisory_xact_lock(hashtext('blendpick-secret-link-migration'));
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS link_price integer;
ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS link_code text;
CREATE UNIQUE INDEX IF NOT EXISTS products_shop_link_code_idx ON products_shop (link_code) WHERE link_code IS NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS link_code text;
