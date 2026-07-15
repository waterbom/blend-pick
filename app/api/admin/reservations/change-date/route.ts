import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { quoteReservation, nextISO, mdLabel, PACKAGES, type PkgKey, type RoomType } from "@/lib/hotel";
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

// 관리자 예약 변경 (날짜·인원·객실) — 재고 스왑 + 자동 차액환불 / 추가 차액 결제링크
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, checkIn, checkOut, pkg: reqPkg, room: reqRoom, preview } = await req.json();
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
  const hotelName = parts[0] || "여수 UTOP 마리나";
  const oldPkg = pkgOf(ord.product_name || "");
  const oldRoom = (parts[2] || "") as RoomType;

  // 변경 대상 패키지·객실 — 요청에 없으면 기존 값 유지 (날짜만 변경)
  const pkg = (reqPkg || oldPkg) as PkgKey;
  const room = (reqRoom || oldRoom) as RoomType;

  // 새 조건 유효성 + 요금 재계산 (패키지-객실 조합도 여기서 검증: 3·4인은 트윈만)
  const q = quoteReservation(pkg, room, checkIn, checkOut);
  if (!q) {
    const badCombo = pkg in PACKAGES && !PACKAGES[pkg].rooms.includes(room);
    return NextResponse.json(
      { error: badCombo ? `${PACKAGES[pkg].label}는 ${room} 선택이 불가합니다.` : "선택한 날짜가 예약 가능 범위를 벗어났습니다." },
      { status: 400 }
    );
  }

  const oldTotal = Number(ord.total_amount);
  const newTotal = q.total;
  const diff = newTotal - oldTotal; // >0 추가결제 필요, <0 환불

  // 미리보기 — 실제 변경 없이 차액 + 대상 날짜 잔여 객실을 계산해서 반환 (확인창용)
  if (preview) {
    const dates: string[] = [];
    let d = q.checkIn;
    for (let i = 0; i < q.nights; i++) { dates.push(d); d = nextISO(d); }
    const invRes = await shopPool.query(
      `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d, allocated - booked AS remaining
         FROM hotel_room_inventory
        WHERE room_type = $1 AND stay_date = ANY($2::date[])`,
      [room, dates]
    );
    const remainMap = new Map<string, number>(
      invRes.rows.map((r: { d: string; remaining: number }) => [r.d, Number(r.remaining)])
    );
    // 본인 예약이 점유 중인 밤은 변경 시 반납되므로 +1 — 단, 같은 객실 타입일 때만 (객실 변경 시엔 해당 없음)
    const nightRemains = dates.map((date) => {
      let remaining = remainMap.get(date) ?? 0; // 재고 행 없음 = 배정 없음
      if (room === oldRoom && date >= ord.old_in && date < ord.old_out) remaining += 1;
      return { date, remaining };
    });
    const soldOutDates = nightRemains.filter((n) => n.remaining <= 0).map((n) => n.date);
    // 추가 차액이면 결제링크를 미리 발급 — 확정 전에 고객에게 먼저 보내 결제받는 흐름 지원
    // (토큰은 금액·용도 서명일 뿐 예약 상태와 무관해서 확정 전에 만들어도 동일하게 유효)
    let previewPayLink: string | null = null;
    if (diff > 0) {
      const base = process.env.NODE_ENV === "production" ? "https://shop.blendpunch.com" : "http://localhost:3000";
      const token = await signPayLink(diff, `${ord.order_number} 예약 변경 차액`);
      previewPayLink = `${base}/pay/extra?t=${token}`;
    }
    return NextResponse.json({
      ok: true,
      preview: true,
      payLink: previewPayLink,
      diff,
      oldTotal,
      newTotal,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights: q.nights,
      pkgLabel: PACKAGES[pkg].label,
      room,
      available: soldOutDates.length === 0,
      minRemaining: Math.min(...nightRemains.map((n) => n.remaining)),
      soldOutDates,
    });
  }

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    // 1) 기존 밤 재고 반납 — 기존 객실 타입 기준
    let cur = ord.old_in as string;
    while (cur < ord.old_out) {
      await client.query(
        `UPDATE hotel_room_inventory SET booked = GREATEST(booked - 1, 0) WHERE stay_date = $1 AND room_type = $2`,
        [cur, oldRoom]
      );
      cur = nextISO(cur);
    }

    // 2) 새 밤 재고 차감 — 새 객실 타입 기준 (반납 후라 겹치는 밤도 정상 처리) — 실패 시 롤백
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
        `UPDATE order_items SET product_name = $1, option_label = $2 WHERE id = $3`,
        [`${hotelName} · ${PACKAGES[pkg].label} · ${room}`, `${room} · ${stayLabel}`, ord.item_id]
      );
    }

    // 4) 차액 처리
    let refunded = 0;
    let needRepay = false;

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
      // 더 비쌈 → 자동 결제 불가(기존 결제 증액 불가). 차액 결제링크 생성해서 반환.
      needRepay = true;
    }

    await client.query("COMMIT");

    // 4) 추가 차액 결제링크 — 관리자가 복사해서 고객에게 전달 (금액 서명 포함, URL 조작 불가)
    // 고객에게 가는 링크라 프록시 뒤 origin 대신 공개 도메인을 사용
    let payLink: string | null = null;
    if (needRepay) {
      const base = process.env.NODE_ENV === "production" ? "https://shop.blendpunch.com" : "http://localhost:3000";
      const token = await signPayLink(diff, `${ord.order_number} 예약 변경 차액`);
      payLink = `${base}/pay/extra?t=${token}`;
    }

    return NextResponse.json({
      ok: true,
      diff,
      newTotal,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights: q.nights,
      pkgLabel: PACKAGES[pkg].label,
      room,
      refunded,
      needRepay,
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
