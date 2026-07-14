/**
 * 객실 배정 수량(allocated) 조정 — 트랜잭션 + 변경 전/후 출력
 *
 * 실행 예:
 *   node scripts/set-room-inventory.cjs --date=2026-07-17 --room="디럭스 더블" --add=1
 *   node scripts/set-room-inventory.cjs --date=2026-07-17 --room="디럭스 더블" --set=3
 *
 * --add=N : 현재 배정에서 N개 증감 (음수 가능)
 * --set=N : 배정을 N개로 지정
 *
 * 안전장치: 이미 예약된 수(booked)보다 적게 배정할 수 없음.
 * 주의: 접속하는 DB는 SHOP_DATABASE_URL 기준. 상용 반영은 EC2에서 실행할 것.
 */
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

const conn = process.env.SHOP_DATABASE_URL;
if (!conn) {
  console.error("❌ SHOP_DATABASE_URL 이 필요합니다.");
  process.exit(1);
}

const arg = (k) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : null;
};

const date = arg("date");
const room = arg("room");
const add = arg("add");
const set = arg("set");

if (!date || !room || (add === null && set === null)) {
  console.error("사용법: node scripts/set-room-inventory.cjs --date=YYYY-MM-DD --room=\"객실명\" (--add=N | --set=N)");
  process.exit(1);
}

const { Pool } = require("pg");
const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

(async () => {
  console.log(`DB: ${conn.split("/").pop().split("?")[0]}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cur = await client.query(
      `SELECT allocated, booked FROM hotel_room_inventory
        WHERE stay_date = $1 AND room_type = $2 FOR UPDATE`,
      [date, room]
    );
    if (cur.rowCount === 0) {
      throw new Error(`해당 행 없음: ${date} / ${room} (객실명 오타이거나 시딩 안 된 날짜)`);
    }

    const { allocated, booked } = cur.rows[0];
    const next = set !== null ? Number(set) : allocated + Number(add);

    if (!Number.isInteger(next) || next < 0) throw new Error(`잘못된 배정 수량: ${next}`);
    if (next < booked) throw new Error(`이미 예약 ${booked}건이라 배정을 ${next}개로 줄일 수 없습니다.`);

    await client.query(
      `UPDATE hotel_room_inventory SET allocated = $1 WHERE stay_date = $2 AND room_type = $3`,
      [next, date, room]
    );
    await client.query("COMMIT");

    console.log(`\n${date} · ${room}`);
    console.log(`  배정  ${allocated} → ${next}`);
    console.log(`  예약  ${booked} (변동 없음)`);
    console.log(`  남음  ${allocated - booked} → ${next - booked}\n`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`❌ ${e.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
