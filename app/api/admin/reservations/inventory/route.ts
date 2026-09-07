import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 날짜·객실별 재고 현황 (배정 / 예약됨 / 남음)
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await currentAdminSite()).key !== "blendpick") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { rows } = await shopPool.query(
    `SELECT to_char(stay_date, 'YYYY-MM-DD') AS date,
            room_type,
            allocated,
            booked,
            (allocated - booked) AS remaining
       FROM hotel_room_inventory
      ORDER BY stay_date, room_type`
  );
  return NextResponse.json(rows);
}
