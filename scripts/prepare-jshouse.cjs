// JS하우스 예약 테이블 준비 — 배포 때마다 실행해도 기존 설정·예약은 그대로 둔다.
const fs = require('node:fs'), path = require('node:path');
async function prepare(pool) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'jshouse.sql'), 'utf8'));
}
module.exports = { prepare };
if (require.main === module) {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  const { Pool } = require('pg');
  if (!process.env.SHOP_DATABASE_URL) throw Error('SHOP_DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.SHOP_DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
  prepare(pool)
    .then(() => console.log('JS House schema ready; existing settings and bookings preserved'))
    .catch(() => { console.error('JS House schema migration failed'); process.exitCode = 1; })
    .finally(() => pool.end());
}
