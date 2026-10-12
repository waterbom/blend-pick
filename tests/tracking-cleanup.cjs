const {test, before, beforeEach, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {PGlite} = require('@electric-sql/pglite');
const {prepare, clearLegacyTracking} = require('../scripts/prepare-commerce-automation.cjs');

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cutoff = '2026-10-12T10:54:44.068902Z';
let failRunDelete = false;
let released = 0;
const query = async (sql, params) => {
  if (failRunDelete && sql.startsWith('DELETE FROM shipment_tracking_runs')) throw Error('simulated failure');
  const result = await db.query(sql, params);
  return {...result, rowCount: result.affectedRows ?? result.rows.length};
};
const pool = {
  query: sql => db.exec(sql),
  connect: async () => ({query, release: () => { released++; }}),
};

before(async () => {
  await db.exec(`CREATE TABLE orders (
    id uuid PRIMARY KEY, site text, status text, tracking_number text,
    tracking_checked_at timestamptz, delivered_at timestamptz
  );
  CREATE TABLE settlement_events(id integer PRIMARY KEY, order_id uuid REFERENCES orders(id), amount integer);`);
  await db.exec(fs.readFileSync('ops/sql/commerce-automation.sql', 'utf8'));
});
beforeEach(async () => {
  failRunDelete = false;
  released = 0;
  await db.exec('DROP TABLE IF EXISTS commerce_data_migrations; TRUNCATE orders CASCADE; TRUNCATE shipment_tracking_runs, admin_shipment_import_batches;');
  for (let n = 1; n <= 5; n++) {
    await query(`INSERT INTO orders VALUES($1,$2,$3,$4,$5,$6)`, [id(n), n % 2 ? 'sanjipick' : 'blendpick', n === 4 ? 'delivered' : 'shipped', `TEST${n}`, cutoff, n === 4 ? cutoff : null]);
    const checkedAt = n <= 2 ? '2026-10-12T10:54:44.068901Z' : n === 5 ? cutoff : '2026-10-12T10:57:58Z';
    await query(`INSERT INTO shipment_tracking_checks(order_id,tracking_number,checked_at,failures,error,next_attempt_at)
      VALUES($1,$2,$3,$4,$5,'2026-10-13T00:00:00Z')`, [id(n), `TEST${n}`, checkedAt, n % 2 ? 8 : 0, n % 2 ? 'lookup failed' : null]);
  }
  const runs = [
    [1, 'sanjipick', 'failed', '2026-10-12T10:00:00Z', '2026-10-12T10:01:00Z'],
    [2, 'blendpick', 'success', '2026-10-12T10:50:00Z', '2026-10-12T10:54:44.068901Z'],
    [3, 'sanjipick', 'success', '2026-10-12T10:54:40Z', '2026-10-12T10:57:58Z'],
    [4, 'sanjipick', 'running', cutoff, null],
    [5, 'blendpick', 'running', '2026-10-11T00:00:00Z', null],
    [6, 'blendpick', 'success', '2026-10-12T11:00:00Z', '2026-10-12T11:01:00Z'],
    [7, 'blendpick', 'success', '2026-10-12T10:50:00Z', cutoff],
  ];
  for (const [n, site, status, started, finished] of runs) {
    await query(`INSERT INTO shipment_tracking_runs(id,site,source,status,started_at,finished_at,checked,results)
      VALUES($1,$2,'automatic',$3,$4,$5,1,'[{"message":"test result"}]')`, [id(n), site, status, started, finished]);
  }
  await query(`INSERT INTO shipment_notifications(order_id,site,tracking_number,body,status,last_error)
    VALUES($1,'sanjipick','TEST1','pending message','retry','unrelated SMS failure')`, [id(1)]);
  await query(`INSERT INTO settlement_events VALUES(1,$1,10000)`, [id(4)]);
  await query(`INSERT INTO admin_shipment_import_batches VALUES('sanjipick',$1,'admin','hash',1,'{"ok":true}','2026-10-11')`, [id(9)]);
});
after(() => db.close());

test('cleanup removes pre-refresh lookups across sites and preserves exact boundary, newer results and business records', async () => {
  const tables = ['orders', 'settlement_events', 'shipment_notifications', 'admin_shipment_import_batches'];
  const before = await Promise.all(tables.map(table => query(`SELECT * FROM ${table}`)));
  const survivingChecks = await query('SELECT * FROM shipment_tracking_checks WHERE order_id >= $1 ORDER BY order_id', [id(3)]);
  const survivingRuns = await query('SELECT * FROM shipment_tracking_runs WHERE id=ANY($1::uuid[]) ORDER BY id', [[3, 4, 6, 7].map(id)]);
  const result = await prepare(pool);
  assert.deepEqual(result, {cutoff, checks: 2, runs: 3, alreadyApplied: false});
  assert.deepEqual((await query('SELECT * FROM shipment_tracking_checks ORDER BY order_id')).rows, survivingChecks.rows);
  assert.deepEqual((await query('SELECT * FROM shipment_tracking_runs ORDER BY id')).rows, survivingRuns.rows);
  for (let i = 0; i < tables.length; i++) assert.deepEqual((await query(`SELECT * FROM ${tables[i]}`)).rows, before[i].rows);
  assert.equal(released, 1);
});

test('redeploy does not repeat the historical deletion or erase later lookup attempts', async () => {
  await prepare(pool);
  // Even a deliberately backdated import is protected by the durable completion marker.
  await query(`INSERT INTO shipment_tracking_checks(order_id,tracking_number,checked_at) VALUES($1,'TEST1','2026-10-01')`, [id(1)]);
  const before = (await query('SELECT * FROM shipment_tracking_checks ORDER BY order_id')).rows;
  const result = await prepare(pool);
  assert.equal(result.alreadyApplied, true);
  assert.deepEqual((await query('SELECT * FROM shipment_tracking_checks ORDER BY order_id')).rows, before);
  assert.equal((await query('SELECT * FROM commerce_data_migrations')).rows.length, 1);
  assert.equal(released, 2);
});

test('cleanup failure rolls back deletions and completion marker, then can retry safely', async () => {
  const before = (await query('SELECT * FROM shipment_tracking_checks ORDER BY order_id')).rows;
  failRunDelete = true;
  await assert.rejects(clearLegacyTracking(pool), /simulated failure/);
  assert.deepEqual((await query('SELECT * FROM shipment_tracking_checks ORDER BY order_id')).rows, before);
  assert.equal((await query("SELECT to_regclass('commerce_data_migrations') AS marker")).rows[0].marker, null);
  assert.equal(released, 1);
  failRunDelete = false;
  assert.equal((await clearLegacyTracking(pool)).alreadyApplied, false);
});
