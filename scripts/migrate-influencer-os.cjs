/**
 * 인플루언서 정산 기능 — OS DB 마이그레이션 (idempotent)
 *
 *  - influencers: 정산/서류/포털계정 관련 컬럼 추가
 *  - campaigns: 공구별 수수료율·공급가 추가
 *
 * 실행: node scripts/migrate-influencer-os.cjs
 *   (DATABASE_URL 환경변수 필요 — .env.local / .env 또는 process.env)
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

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("❌ DATABASE_URL 이 필요합니다.");
  process.exit(1);
}

const { Pool } = require("pg");
const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

(async () => {
  // influencers — 연락처/정산정보/서류/포털계정
  const influencerCols = [
    "phone            text",
    "followers_count  integer",
    "category         text",
    "business_type    text",   // 'general' | 'simplified' | 'freelancer'
    "bank_name        text",
    "bank_account     text",
    "bank_holder      text",
    "tax_email        text",   // 세금계산서 수신 이메일 (일반사업자)
    "memo             text",
    "user_id          uuid",   // shop_users.id — 포털 로그인 계정 링크
    "id_card_file     text",   // 신분증 사본 (private-uploads 파일명)
    "biz_cert_file    text",   // 사업자등록증
    "bankbook_file    text",   // 통장사본
  ];
  for (const col of influencerCols) {
    await pool.query(`ALTER TABLE influencers ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // campaigns — 공구별 정산 설정
  await pool.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2)");
  await pool.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS supply_price integer");

  console.log("✅ OS DB 마이그레이션 완료 (influencers 13컬럼, campaigns 2컬럼)");
  await pool.end();
})().catch((e) => {
  console.error("❌ ERR:", e.message);
  process.exit(1);
});
