/**
 * 자동 배송추적 — 배송중(shipped) 주문을 스위트트래커로 조회해 배송완료 자동 전환.
 * 관리자 화면의 "배송추적 실행" 버튼과 동일한 로직 (무인 실행용).
 *
 * 실행: node scripts/auto-track-shipments.cjs
 *   (SHOP_DATABASE_URL, SWEETTRACKER_API_KEY 필요 — .env.local / .env 또는 process.env)
 *
 * 무료 쿼터(월 1,000건) 보호: 실행당 최대 80건, 오래된 주문부터.
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

const { Pool } = require("pg");

const API_KEY = process.env.SWEETTRACKER_API_KEY;
const DB_URL = process.env.SHOP_DATABASE_URL;
const LIMIT = 80;
const FEE_RATE = { card: 0.0363, transfer: 0.0165 };
// 레거시 텍스트 코드 → 스위트트래커 숫자 코드 (lib/carriers.ts와 동일)
const LEGACY = { cj: "04", hanjin: "05", lotte: "08", post: "01", logen: "06" };

function toCode(stored) {
  if (!stored) return null;
  if (/^\d{1,3}$/.test(stored)) return stored;
  return LEGACY[stored.toLowerCase()] ?? null;
}

async function fetchStatus(invoice, code) {
  try {
    const url = new URL("https://info.sweettracker.co.kr/api/v1/trackingInfo");
    url.searchParams.set("t_key", API_KEY);
    url.searchParams.set("t_code", code);
    url.searchParams.set("t_invoice", invoice);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.status === false) return null;
    const level = Number(data.lastStateDetail?.level ?? 0);
    return { delivered: level >= 6, text: data.lastStateDetail?.text ?? "" };
  } catch {
    return null;
  }
}

(async () => {
  if (!API_KEY) { console.error("SWEETTRACKER_API_KEY 미설정 — 종료"); process.exit(1); }
  if (!DB_URL) { console.error("SHOP_DATABASE_URL 미설정 — 종료"); process.exit(1); }

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const { rows: orders } = await pool.query(
    `SELECT id, order_number, tracking_company, tracking_number, total_amount, payment_method, payment_key
     FROM orders
     WHERE status = 'shipped' AND tracking_number IS NOT NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [LIMIT]
  );

  if (orders.length === 0) { console.log("배송중 주문 없음 — 종료"); await pool.end(); return; }

  const deliveredIds = [];
  let failed = 0;
  for (const o of orders) {
    const code = toCode(o.tracking_company);
    if (!code) { console.log(`  ${o.order_number}: 택배사 미인식(${o.tracking_company})`); failed++; continue; }
    const info = await fetchStatus(o.tracking_number, code);
    if (!info) { console.log(`  ${o.order_number}: 조회 실패`); failed++; continue; }
    console.log(`  ${o.order_number}: ${info.text || (info.delivered ? "배송완료" : "배송중")}`);
    if (info.delivered) deliveredIds.push(o.id);
  }

  if (deliveredIds.length > 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: updated } = await client.query(
        `UPDATE orders SET status = 'delivered'
         WHERE id = ANY($1::uuid[]) AND status = 'shipped'
         RETURNING id, order_number, total_amount, payment_method, payment_key`,
        [deliveredIds]
      );
      for (const order of updated) {
        const existing = await client.query(`SELECT id FROM settlements WHERE order_id = $1`, [order.id]);
        if (existing.rows.length > 0) continue;
        const rate = FEE_RATE[order.payment_method] ?? FEE_RATE.card;
        const gross = Number(order.total_amount);
        const fee = Math.round(gross * rate);
        await client.query(
          `INSERT INTO settlements (payment_key, order_id, gross_amount, fee, net_amount, settled_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [order.payment_key || `auto_${order.order_number}`, order.id, gross, fee, gross - fee]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("배송완료 처리 실패:", e.message);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }

  console.log(`완료: ${orders.length}건 조회 / ${deliveredIds.length}건 배송완료 전환 / ${failed}건 실패`);
  await pool.end();
})();
