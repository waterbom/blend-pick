// 주문 관련 더미데이터 초기화 — 백업 후 삭제 (트랜잭션)
// hotel_room_inventory 배정값은 보존, booked만 0으로.
const fs = require("fs");
const path = require("path");
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of fs.readFileSync(path.join(process.cwd(), f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.SHOP_DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  // 0. orders 를 참조하는 FK 자식 테이블 확인
  const fks = await pool.query(`
    SELECT tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='orders'`);
  console.log("orders 참조 자식 테이블:", fks.rows.map((r) => r.table_name).join(", ") || "(order_items 외 없음)");

  // 1. 백업 (orders · order_items · settlements)
  const orders = (await pool.query("SELECT * FROM orders")).rows;
  const items = (await pool.query("SELECT * FROM order_items")).rows;
  const settlements = (await pool.query("SELECT * FROM settlements")).rows;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join("scripts", `backup-orders-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ orders, order_items: items, settlements }, null, 2));
  console.log(`백업 저장: ${file}  (orders ${orders.length} · order_items ${items.length} · settlements ${settlements.length})`);

  // 2. 삭제 (트랜잭션) — 자식(정산·항목) 먼저, orders 마지막. 수동정산(order_id NULL)은 보존.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ds = await client.query("DELETE FROM settlements WHERE order_id IS NOT NULL");
    const di = await client.query("DELETE FROM order_items");
    const doo = await client.query("DELETE FROM orders");
    const inv = await client.query("UPDATE hotel_room_inventory SET booked = 0 WHERE booked <> 0");
    await client.query("COMMIT");
    console.log(`삭제 완료 — settlements ${ds.rowCount} · order_items ${di.rowCount} · orders ${doo.rowCount} · 재고 booked 리셋 ${inv.rowCount}행`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("롤백:", e.message);
    process.exit(1);
  } finally {
    client.release();
  }

  // 3. 확인
  const after = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM orders) AS orders,
            (SELECT COUNT(*)::int FROM order_items) AS items,
            (SELECT COALESCE(SUM(booked),0)::int FROM hotel_room_inventory) AS booked,
            (SELECT COUNT(*)::int FROM hotel_room_inventory) AS inv_rows`);
  console.log("초기화 후:", after.rows[0]);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
