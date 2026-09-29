import { Pool } from "pg";
import { ApiError, reportApiError } from '@/lib/api-errors';

const shopPool = new Pool({
  connectionString: process.env.SHOP_DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
});
shopPool.on('error', cause => reportApiError(new ApiError('DB_UNAVAILABLE', undefined, 503, {cause}), 'db.shop.idle-connection'));

export default shopPool;
