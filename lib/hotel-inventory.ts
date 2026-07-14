import type { PoolClient } from "pg";
import shopPool from "@/lib/db-shop";
import { nextISO } from "@/lib/hotel";

// 재고 소진(마감)된 날짜 목록 — 해당 객실 타입 기준
export async function getSoldOutDates(room: string): Promise<string[]> {
  const r = await shopPool.query(
    `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d
       FROM hotel_room_inventory
      WHERE room_type = $1 AND allocated - booked <= 0
      ORDER BY stay_date`,
    [room]
  );
  return r.rows.map((x: { d: string }) => x.d);
}

// 투숙 전 기간(모든 밤) 재고가 남아있는지
export async function isStayAvailable(room: string, checkIn: string, nights: number): Promise<boolean> {
  const dates: string[] = [];
  let cur = checkIn;
  for (let i = 0; i < nights; i++) { dates.push(cur); cur = nextISO(cur); }
  const r = await shopPool.query(
    `SELECT COUNT(*)::int AS ok
       FROM hotel_room_inventory
      WHERE room_type = $1 AND stay_date = ANY($2::date[]) AND allocated - booked > 0`,
    [room, dates]
  );
  return r.rows[0].ok === nights;
}

// 투숙 기간 중 가장 적게 남은 밤의 잔여 객실 수 (마지막 방 안내용)
export async function minRemainingForStay(room: string, checkIn: string, nights: number): Promise<number> {
  const dates: string[] = [];
  let cur = checkIn;
  for (let i = 0; i < nights; i++) { dates.push(cur); cur = nextISO(cur); }
  const r = await shopPool.query(
    `SELECT COALESCE(MIN(allocated - booked), 0)::int AS remaining
       FROM hotel_room_inventory
      WHERE room_type = $1 AND stay_date = ANY($2::date[])`,
    [room, dates]
  );
  return r.rows[0].remaining;
}

// 예약 확정 시 각 밤 재고 차감. 한 밤이라도 재고가 없으면 false(호출측에서 롤백).
export async function decrementStay(
  client: PoolClient,
  room: string,
  checkIn: string,
  nights: number
): Promise<boolean> {
  let cur = checkIn;
  for (let i = 0; i < nights; i++) {
    const u = await client.query(
      `UPDATE hotel_room_inventory
          SET booked = booked + 1
        WHERE stay_date = $1 AND room_type = $2 AND booked < allocated`,
      [cur, room]
    );
    if (u.rowCount !== 1) return false;
    cur = nextISO(cur);
  }
  return true;
}
