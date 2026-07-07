import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { nextISO } from "@/lib/hotel";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") || "";
  const where = status
    ? `WHERE o.order_type = 'hotel' AND o.status = $1`
    : `WHERE o.order_type = 'hotel'`;
  const params = status ? [status] : [];

  const result = await shopPool.query(
    `SELECT
       o.id, o.order_number, o.status,
       o.buyer_name, o.buyer_phone,
       o.addr_memo,
       to_char(o.stay_check_in, 'YYYY-MM-DD') AS stay_check_in,
       to_char(o.stay_check_out, 'YYYY-MM-DD') AS stay_check_out,
       o.total_amount, o.created_at,
       to_char(o.paid_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS paid_at_kst,
       (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name
     FROM orders o
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 500`,
    params
  );

  return NextResponse.json(result.rows);
}

// 예약 상태 변경 (취소 시 토스 환불 + 재고 복원)
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  const allowed = ["paid", "checked_in", "cancelled", "no_show"];
  if (!id || !allowed.includes(status)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 취소가 아니면 상태만 변경
  if (status !== "cancelled") {
    // 이미 취소·환불된 예약은 되돌릴 수 없음 (결제 환불·재고 복원이 끝난 최종 상태)
    const cur = await shopPool.query(
      `SELECT status FROM orders WHERE id = $1 AND order_type = 'hotel'`,
      [id]
    );
    if (!cur.rows[0]) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
    if (cur.rows[0].status === "cancelled") {
      return NextResponse.json(
        { error: "이미 취소·환불된 예약은 상태를 변경할 수 없습니다." },
        { status: 409 }
      );
    }
    const r = await shopPool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND order_type = 'hotel'`,
      [status, id]
    );
    return NextResponse.json({ ok: true, updated: r.rowCount });
  }

  // 취소 → 결제 환불 + 재고 복원
  const { rows } = await shopPool.query(
    `SELECT o.status, o.payment_key,
            to_char(o.stay_check_in, 'YYYY-MM-DD') AS ci,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS co,
            (SELECT option_label FROM order_items WHERE order_id = o.id LIMIT 1) AS opt
       FROM orders o WHERE o.id = $1 AND o.order_type = 'hotel'`,
    [id]
  );
  const ord = rows[0];
  if (!ord) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  if (ord.status === "cancelled") return NextResponse.json({ ok: true, alreadyCancelled: true });

  // 1) 토스 결제 취소 (실결제 건만)
  if (ord.payment_key && !ord.payment_key.startsWith("SIM_")) {
    const secretKey = process.env.TOSS_SECRET_KEY;
    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${ord.payment_key}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancelReason: "관리자 예약 취소" }),
    });
    if (!tossRes.ok) {
      const e = await tossRes.json().catch(() => ({}));
      // 이미 취소된 결제는 정상 처리(상태·재고 정리 계속 진행)
      if (e.code !== "ALREADY_CANCELED_PAYMENT") {
        return NextResponse.json({ ok: false, error: e.message || "토스 환불에 실패했습니다." }, { status: 400 });
      }
    }
  }

  // 2) 상태 취소 + 재고 복원 (option_label = "객실 · 기간" → 앞이 객실타입)
  const room = String(ord.opt || "").split(" · ")[0];
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [id]);
    if (room && ord.ci && ord.co) {
      let cur = ord.ci;
      while (cur < ord.co) {
        await client.query(
          `UPDATE hotel_room_inventory SET booked = GREATEST(booked - 1, 0) WHERE stay_date = $1 AND room_type = $2`,
          [cur, room]
        );
        cur = nextISO(cur);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[reservations cancel] 재고 복원 실패:", e);
    // 결제는 이미 환불됨 → 상태는 취소로 처리(재고는 수동 조정)
    await shopPool.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [id]);
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, refunded: true });
}
