/**
 * 인플루언서 정산 기능 — Shop DB 마이그레이션 (idempotent)
 *
 *  - orders: 결제시점 인플루언서/공구/수수료율 스냅샷
 *  - order_items / products_shop / product_options: 공급가
 *  - campaign_costs: 공구별 기타비용 (배송비/광고비/샘플/기타)
 *  - influencer_payouts: 확정 정산 스냅샷
 *
 * 실행: node scripts/migrate-influencer-shop.cjs
 *   (SHOP_DATABASE_URL 환경변수 필요 — .env.local / .env 또는 process.env)
 */
const fs = require("fs");
const path = require("path");

for (const f of [".env.local", ".env"]) {
  try {
    for (const line of fs.readFileSync(path.join(process.cwd(), f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const conn = process.env.SHOP_DATABASE_URL;
if (!conn) {
  console.error("❌ SHOP_DATABASE_URL 이 필요합니다.");
  process.exit(1);
}

const { Pool } = require("pg");
const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

(async () => {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

  // orders — 결제시점 스냅샷 (FK 없음: OS DB의 id라 크로스 DB)
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS influencer_id uuid");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id uuid");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS influencer_name text");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2)");
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id) WHERE campaign_id IS NOT NULL"
  );

  // 공급가 — 주문 스냅샷 + 상품/옵션 마스터
  await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS supply_price integer");
  await pool.query("ALTER TABLE products_shop ADD COLUMN IF NOT EXISTS supply_price integer");
  await pool.query("ALTER TABLE product_options ADD COLUMN IF NOT EXISTS supply_price integer");

  // 공구별 기타비용
  await pool.query(`CREATE TABLE IF NOT EXISTS campaign_costs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    category    text NOT NULL,   -- 'shipping' | 'ad' | 'sample' | 'etc'
    amount      integer NOT NULL,
    memo        text,
    created_at  timestamptz DEFAULT now()
  )`);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_campaign_costs_campaign ON campaign_costs(campaign_id)"
  );

  // 인플루언서 확정 정산 (확정 시점 수치 동결)
  await pool.query(`CREATE TABLE IF NOT EXISTS influencer_payouts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     uuid NOT NULL,
    influencer_id   uuid NOT NULL,
    business_type   text NOT NULL,
    gross_sales     bigint NOT NULL,
    commission_rate numeric(5,2) NOT NULL,
    commission      bigint NOT NULL,
    supply_value    bigint NOT NULL,
    vat             bigint NOT NULL DEFAULT 0,
    withholding     bigint NOT NULL DEFAULT 0,
    payout_amount   bigint NOT NULL,
    status          text NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid'
    paid_at         timestamptz,
    memo            text,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE (campaign_id, influencer_id)
  )`);

  console.log("✅ Shop DB 마이그레이션 완료 (orders 4컬럼, 공급가 3곳, campaign_costs, influencer_payouts)");
  await pool.end();
})().catch((e) => {
  console.error("❌ ERR:", e.message);
  process.exit(1);
});
