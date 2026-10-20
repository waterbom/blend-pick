// 설정 값과 접속 URL은 출력하지 않는다. 명시적으로 켜진 통계 DB만 준비한다.
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
async function prepare(env = process.env, createPool = options => new Pool(options)) {
  if (env.ANALYTICS_ENABLED !== 'true') {
    console.log('Visit analytics: DISABLED (no database changes).');
    console.log(`Visit analytics configuration: database=${Boolean(env.ANALYTICS_DATABASE_URL)}, hash_key=${(env.ANALYTICS_HASH_SECRET?.length || 0) >= 32}`);
    return 'disabled';
  }
  if (!env.ANALYTICS_DATABASE_URL || (env.ANALYTICS_HASH_SECRET?.length || 0) < 32) throw Error('configuration');
  const pool = createPool({ connectionString: env.ANALYTICS_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  try {
    const verify=async()=>{
      await pool.query('SELECT site,event_id,visitor_hash,session_id,page,occurred_at FROM analytics_pageviews LIMIT 0');
      await pool.query('SELECT site,id,visitor_hash,started_at,last_seen_at FROM analytics_sessions LIMIT 0');
    };
    try{await verify();}catch(e){
      if(e.code!=='42P01')throw e;
      await pool.query(fs.readFileSync(path.join(__dirname, '../ops/sql/visit-analytics.sql'), 'utf8'));
      await verify();
    }
    console.log('Visit analytics: ENABLED; dedicated storage schema verified.');
    return 'enabled';
  } finally { await pool.end(); }
}
module.exports = { prepare };
if (require.main === module) {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  prepare().catch(() => { console.error('Visit analytics setup failed. Check analytics settings and dedicated database permissions; values are not displayed.'); process.exitCode = 1; });
}
