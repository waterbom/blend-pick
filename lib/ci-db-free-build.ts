import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { connection } from 'next/server';

// Only the isolated CI build opts in. Never hide a configured DB failure or
// return empty catalog data that could be cached into a production artifact.
export async function deferDbFreeBuild(page: string): Promise<void> {
  if (process.env.CI !== 'true' || process.env.CI_DB_FREE_BUILD !== 'true' ||
      process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD ||
      process.env.DATABASE_URL || process.env.SHOP_DATABASE_URL) return;

  console.info(`[ci-db-free-build] ${page}: DATABASE_URL and SHOP_DATABASE_URL are absent; deferring database queries until request time.`);
  // Keep this outside query try/catch blocks: Next's prerender bailout must escape.
  await connection();
}
