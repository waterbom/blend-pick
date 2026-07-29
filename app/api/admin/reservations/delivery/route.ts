import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 호텔 전달 도장 — sent(전달 완료: 재전달 시 시각 갱신) / confirmed(호텔 확인: 전달된 건만)
// hotel_sent_at이 "호텔이 아는 마지막 상태의 시점"이 되어, 그 이후의 변경·취소가
// 자동으로 "미전달" 배지로 잡힌다.
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, action } = await req.json();
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length || !["sent", "confirmed"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const r =
    action === "sent"
      ? await shopPool.query(
          `UPDATE orders SET hotel_sent_at = NOW()
            WHERE id = ANY($1::uuid[]) AND order_type = 'hotel'`,
          [list]
        )
      : await shopPool.query(
          `UPDATE orders SET hotel_confirmed_at = NOW()
            WHERE id = ANY($1::uuid[]) AND order_type = 'hotel' AND hotel_sent_at IS NOT NULL`,
          [list]
        );

  return NextResponse.json({ ok: true, updated: r.rowCount });
}
