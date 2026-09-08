import { Pool } from 'pg';
let pool: Pool | undefined;
export function analyticsConfigured() {
  return !!process.env.ANALYTICS_DATABASE_URL && (process.env.ANALYTICS_HASH_SECRET?.length || 0) >= 32;
}
export function analyticsPool() {
  if (!analyticsConfigured()) throw Error('Analytics configuration missing');
  // 주문용 연결을 자동 재사용하지 않는다. TLS는 연결 URL 설정을 따른다.
  pool ??= new Pool({ connectionString: process.env.ANALYTICS_DATABASE_URL, max: 3, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000, statement_timeout: 4000 });
  return pool;
}
