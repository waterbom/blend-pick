import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { quoteReservation, nextISO, mdLabel, type PkgKey, type RoomType } from "@/lib/hotel";
import { decrementStay } from "@/lib/hotel-inventory";
import { signPayLink } from "@/lib/pay-link";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

function pkgOf(name: string): PkgKey {
  if (name.includes("3인")) return "p3";
  if (name.includes("4인")) return "p4";
  return "p2";
}

// 관리자 예약 날짜 변경 — 재고 스왑 + 자동 차액환불 / 추가 차액 링크
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, checkIn, checkOut, preview } = await req.json();
  if (!id || !checkIn || !checkOut) {
    return NextResponse.json({ error: "날짜를 입력해주세요." }, { status: 400 });
  }

  // 예약 로드
  const { rows } = await shopPool.query(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.payment_key, o.buyer_name, o.buyer_phone,
            to_char(o.stay_check_in, 'YYYY-MM-DD')  AS old_in,
            to_char(o.stay_check_out, 'YYYY-MM-DD') AS old_out,
            (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 1) AS product_name,
            (SELECT id FROM order_items WHERE order_id = o.id LIMIT 1) AS item_id
       FROM orders o WHERE o.id = $1 AND o.order_type = 'hotel'`,
    [id]
  );
  const ord = rows[0];
  if (!ord) return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  if (ord.status !== "paid") {
    return NextResponse.json({ error: "예약확정 상태만 날짜 변경이 가능합니다." }, { status: 400 });
  }

  const parts = String(ord.product_name || "").split(" · ");
  const pkg = pkgOf(ord.product_name || "");
  const room = (parts[2] || "") as RoomType;

  // 새 날짜 유효성 + 요금 재계산
  const q = quoteReservation(pkg, room, checkIn, checkOut);
  if (!q) return NextResponse.json({ error: "선택한 날짜가 예약 가능 범위를 벗어났습니다." }, { status: 400 });

  const oldTotal = Number(ord.total_amount);
  const newTotal = q.total;
  const diff = newTotal - oldTotal; // >0 추가결제 필요, <0 환불

  // 미리보기 — 실제 변경 없이 차액만 계산해서 반환 (확인창용)
  if (preview) {
    return NextResponse.json({
      ok: true,
      preview: true,
      diff,
      oldTotal,
      newTotal,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights: q.nights,
    });
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // 1) 기존 밤 재고 반납
    let cur = ord.old_in as string;
    while (cur < ord.old_out) {
      await client.query(
        `UPDATE hotel_room_inventory SET booked = GREATEST(booked - 1, 0) WHERE stay_date = $1 AND room_type = $2`,
        [cur, room]
      );
      cur = nextISO(cur);
    }

    // 2) 새 밤 재고 차감(반납 후라 겹치는 밤도 정상 처리) — 실패 시 롤백
    const ok = await decrementStay(client, room, q.checkIn, q.nights);
    if (!ok) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "변경하려는 날짜에 남은 방이 없습니다." }, { status: 409 });
    }

    // 3) 주문 날짜/항목 갱신 (더 비싼 경우 total은 실제 결제액 유지, 환불 후엔 아래서 갱신)
    const stayLabel = `${mdLabel(q.checkIn)}~${mdLabel(q.checkOut)} (${q.nights}박)`;
    await client.query(
      `UPDATE orders SET stay_check_in = $1, stay_check_out = $2 WHERE id = $3`,
      [q.checkIn, q.checkOut, id]
    );
    if (ord.item_id) {
      await client.query(
        `UPDATE order_items SET option_label = $1 WHERE id = $2`,
        [`${room} · ${stayLabel}`, ord.item_id]
      );
    }

    // 4) 차액 처리
    let refunded = 0;
    let payLink: string | null = null;

    if (diff < 0) {
      // 더 저렴 → 토스 부분취소(자동 환불)
      const refundAmount = -diff;
      if (ord.payment_key && !String(ord.payment_key).startsWith("SIM_")) {
        const secretKey = process.env.TOSS_SECRET_KEY;
        const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${ord.payment_key}/cancel`, {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ cancelReason: "예약 날짜 변경 차액 환불", cancelAmount: refundAmount }),
        });
        if (!tossRes.ok) {
          const e = await tossRes.json().catch(() => ({}));
          await client.query("ROLLBACK");
          return NextResponse.json({ error: e.message || "차액 환불에 실패했습니다." }, { status: 400 });
        }
      }
      refunded = refundAmount;
      await client.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [newTotal, id]);
    } else if (diff > 0) {
      // 더 비쌈 → 차액 결제 링크 자동 생성 (관리자가 고객에게 전달)
      const token = await signPayLink(diff, `날짜 변경 차액 (${ord.order_number})`);
      const origin = new URL(req.url).origin;
      payLink = `${origin}/pay/extra?t=${token}`;
    }

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      diff,
      newTotal,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights: q.nights,
      refunded,
      payLink,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[change-date] 실패:", e);
    return NextResponse.json({ error: "날짜 변경 처리에 실패했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
