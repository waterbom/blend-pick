/**
 * 주문에 '어느 사이트에서 결제됐는지' 표시 — Shop DB 마이그레이션 (idempotent, 배포 때마다 실행해도 안전)
 *
 *  orders.site  text NOT NULL DEFAULT 'blendpick'   ('blendpick' | 'sanjipick')
 *    - 기존 주문은 전부 블랜드픽이라 기본값으로 채워진다
 *    - 결제 확정 API(app/api/payment/*-confirm)가 요청 호스트/미리보기 쿠키로 판별해 저장
 *    - 어드민 판매 관리 '전체/블랜드픽/산지픽' 필터, 수익·정산 분리의 기준
 *
 * 실행: node scripts/migrate-order-site.cjs
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
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'blendpick'");
  await pool.query("CREATE INDEX IF NOT EXISTS orders_site_created_idx ON orders (site, created_at DESC)");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(fs.readFileSync(path.join(__dirname, "admin-site.sql"), "utf8"));
    await client.query("COMMIT");
    console.log("✅ 관리자 비용·정산 사이트 분리 준비 완료");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const r = await pool.query("SELECT site, COUNT(*)::int AS n FROM orders GROUP BY site ORDER BY site");
  console.log("✅ orders.site 준비 완료:", r.rows.map((x) => `${x.site}=${x.n}`).join(", ") || "주문 없음");
  await pool.end();
})().catch((e) => {
  console.error("❌ 마이그레이션 실패:", e);
  process.exit(1);
});
