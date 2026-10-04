const fs = require('node:fs');
const path = require('node:path');
async function prepare(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '../ops/sql/customer-convenience.sql'), 'utf8'));
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { prepare };
if (require.main === module) {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  if (!process.env.SHOP_DATABASE_URL) throw Error('SHOP_DATABASE_URL is required');
  const pool = new (require('pg').Pool)({connectionString: process.env.SHOP_DATABASE_URL, ssl:{rejectUnauthorized:false}, connectionTimeoutMillis:5000});
  prepare(pool).then(() => console.log('Customer convenience schema ready'))
    .catch(() => { console.error('Customer convenience migration failed'); process.exitCode = 1; }).finally(() => pool.end());
}
