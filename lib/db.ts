import { Pool } from "pg";
import { ApiError, reportApiError } from '@/lib/api-errors';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false, // RDS 자체 서명 인증서 허용
  },
});
pool.on('error', cause => reportApiError(new ApiError('DB_UNAVAILABLE', undefined, 503, {cause}), 'db.catalog.idle-connection'));

export default pool;
