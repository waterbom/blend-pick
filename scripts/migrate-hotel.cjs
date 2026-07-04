/**
 * 호텔공구 DB 마이그레이션 + 객실 재고 시딩 (idempotent — 여러 번 실행해도 안전)
 *
 *  - orders: order_type / stay_check_in / stay_check_out 컬럼 추가
 *  - hotel_room_inventory 테이블 생성 + 배정 객실 수 시딩(기존 행은 유지 → 예약 데이터 보존)
 *
 * 실행: node scripts/migrate-hotel.cjs
 *   (SHOP_DATABASE_URL 환경변수 필요 — .env.local / .env 또는 process.env)
 */
const fs = require("fs");
const path = require("path");

// env 로드: process.env 우선, 없으면 .env.local / .env 에서 읽음
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

const { Pool } = require("pg");
const pool = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const pad = (n) => String(n).padStart(2, "0");
const iso = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

// 07/13 ~ 10/31 (111일) 남은 방 수. 0 = 마감. (실제 배정표 기준)
const deluxe = [
  5,0,0,5,0,3,5,5,3,3,5,5,5,5,5,5,5,3,1,
  1,1,5,5,5,5,5,5,5,5,5,5,5,3,3,3,1,1,0,3,5,5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
];
const twin = [
  10,10,3,10,0,5,10,10,10,0,0,10,10,10,5,5,5,3,1,
  1,1,5,7,7,7,7,7,10,10,10,10,10,3,3,3,10,3,0,5,10,10,10,10,10,10,10,10,10,10,10,
  10,10,10,10,10,10,10,10,0,10,10,10,10,10,10,10,10,10,10,10,5,5,5,5,10,10,10,10,10,10,
  10,5,5,5,10,10,10,5,5,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
];

(async () => {
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'shop'");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stay_check_in date");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stay_check_out date");
  await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS kakao_notified_at timestamptz");
  await pool.query(`CREATE TABLE IF NOT EXISTS hotel_room_inventory (
    stay_date  date NOT NULL,
    room_type  text NOT NULL,
    allocated  int  NOT NULL DEFAULT 0,
    booked     int  NOT NULL DEFAULT 0,
    PRIMARY KEY (stay_date, room_type)
  )`);

  let cur = new Date(2026, 6, 13);
  let seeded = 0;
  for (let i = 0; i < 111; i++) {
    const d = iso(cur);
    const r = await pool.query(
      `INSERT INTO hotel_room_inventory (stay_date, room_type, allocated, booked)
       VALUES ($1, '디럭스 더블', $2, 0), ($1, '패밀리 트윈', $3, 0)
       ON CONFLICT (stay_date, room_type) DO NOTHING`,
      [d, deluxe[i], twin[i]]
    );
    seeded += r.rowCount;
    cur.setDate(cur.getDate() + 1);
  }

  console.log(`✅ 마이그레이션 완료 — 재고 신규 시딩 ${seeded}행 (기존 행/예약은 그대로 유지)`);
  await pool.end();
})().catch((e) => {
  console.error("❌ ERR:", e.message);
  process.exit(1);
});
