const fs = require('node:fs');
const path = require('node:path');

// Verified SweetTracker key refresh + service restart (2026-10-12 19:54:44 KST).
// This is a fixed, user-requested cleanup, never a rolling retention policy.
const REFRESHED_AT = '2026-10-12T10:54:44.068902Z';
const CLEANUP_KEY = 'tracking-before-api-refresh-2026-10-12';

async function clearLegacyTracking(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('commerce-data-migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS commerce_data_migrations (
      key text PRIMARY KEY,
      completed_at timestamptz NOT NULL DEFAULT now(),
      details jsonb NOT NULL
    )`);
    const {rows} = await client.query('SELECT details FROM commerce_data_migrations WHERE key=$1', [CLEANUP_KEY]);
    if (rows.length) {
      await client.query('COMMIT');
      return {...rows[0].details, alreadyApplied: true};
    }

    // Only lookup records are removed. Orders, settlements and SMS are untouched.
    const checks = await client.query('DELETE FROM shipment_tracking_checks WHERE checked_at < $1::timestamptz', [REFRESHED_AT]);
    const runs = await client.query(`DELETE FROM shipment_tracking_runs
      WHERE started_at < $1::timestamptz
        AND COALESCE(finished_at, started_at) < $1::timestamptz
        AND (status <> 'running' OR started_at < NOW() - INTERVAL '30 minutes')`, [REFRESHED_AT]);
    const details = {cutoff: REFRESHED_AT, checks: checks.rowCount, runs: runs.rowCount};
    await client.query('INSERT INTO commerce_data_migrations(key,details) VALUES($1,$2::jsonb)', [CLEANUP_KEY, JSON.stringify(details)]);
    await client.query('COMMIT');
    return {...details, alreadyApplied: false};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function prepare(pool) {
  await pool.query(fs.readFileSync(path.join(__dirname, '../ops/sql/commerce-automation.sql'), 'utf8'));
  return clearLegacyTracking(pool);
}
module.exports = {prepare, clearLegacyTracking};

if (require.main === module) {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  const {Pool} = require('pg');
  if (!process.env.SHOP_DATABASE_URL) throw Error('SHOP_DATABASE_URL is required');
  const pool = new Pool({connectionString: process.env.SHOP_DATABASE_URL, ssl: {rejectUnauthorized: false}, connectionTimeoutMillis: 5000});
  prepare(pool).then(result => {
    console.log('Commerce automation schema ready');
    console.log(result.alreadyApplied
      ? `Tracking history cleanup already applied: cutoff=${result.cutoff}`
      : `Tracking history cleanup complete: cutoff=${result.cutoff}; checks=${result.checks}; runs=${result.runs}`);
  }).catch(() => {
    console.error('Commerce automation schema or tracking history cleanup failed');
    process.exitCode = 1;
  }).finally(() => pool.end());
}
