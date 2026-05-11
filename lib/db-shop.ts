import { Pool } from "pg";

const shopPool = new Pool({
  connectionString: process.env.SHOP_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export default shopPool;
