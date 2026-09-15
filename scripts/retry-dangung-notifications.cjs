require('@next/env').loadEnvConfig(process.cwd(), false);
const {Pool} = require('pg');
const {sendSMS, smsConfigured} = require('../lib/sms-provider.cjs');
const {processQueue} = require('../lib/dangung-notifications.cjs');
(async () => {
  if (!process.env.SHOP_DATABASE_URL) throw Error('Database configuration missing');
  const pool = new Pool({connectionString: process.env.SHOP_DATABASE_URL, ssl: {rejectUnauthorized: false}, connectionTimeoutMillis: 5000});
  try {
    await pool.query('DELETE FROM dangung_lookup_access WHERE expires_at<NOW()');
    await pool.query("DELETE FROM dangung_lookup_attempts WHERE resets_at<NOW()-INTERVAL '1 day'");
    if (!smsConfigured()) { console.log('Dangung SMS not configured; queued notifications retained'); return; }
    const result = await processQueue(pool, sendSMS, {limit: 20});
    console.log(JSON.stringify(result));
    if (result.review) process.exitCode = 1;
  } finally { await pool.end(); }
})().catch(() => { console.error('Dangung notification queue requires inspection'); process.exitCode = 1; });
