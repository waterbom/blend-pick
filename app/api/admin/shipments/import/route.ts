import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { smsConfigured } from "@/lib/sms";
import { sendShipmentSMS } from "@/lib/ship-notify";

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// POST /api/admin/shipments/import
// body: { rows: Array<{ order_number: string; carrier: string; tracking_number: string }> }
// → 주문 상태를 shipped로 변경 + 운송장 정보 저장
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await req.json() as {
    rows: { order_number: string; carrier: string; tracking_number: string }[];
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "데이터가 없습니다" }, { status: 400 });
  }

  const results: { order_number: string; success: boolean; reason?: string }[] = [];
  // 이번에 새로 배송중으로 바뀐 건만 발송 문자 대상 — 운송장 재등록(이미 배송중)은 제외해 중복 발송 방지
  const toNotify: { order_number: string; name: string; phone: string; carrier: string | null; tracking_number: string }[] = [];

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const { order_number, carrier, tracking_number } = row;
      if (!order_number || !tracking_number) {
        results.push({ order_number: order_number ?? "", success: false, reason: "주문번호 또는 운송장번호 누락" });
        continue;
      }

      // 결제완료~상품준비중 어느 단계든 운송장이 등록되면 배송중으로 전환
      const { rowCount, rows: updated } = await client.query(
        `UPDATE orders
         SET status = 'shipped',
             shipped_at = COALESCE(shipped_at, NOW()),
             tracking_company = $2,
             tracking_number  = $3
         WHERE order_number = $1
           AND status IN ('paid', 'confirmed', 'preparing')
         RETURNING COALESCE(recipient_name, buyer_name) AS name,
                   COALESCE(recipient_phone, buyer_phone) AS phone`,
        [order_number, carrier || null, tracking_number]
      );

      if ((rowCount ?? 0) === 0) {
        const existing = await client.query(
          `SELECT status FROM orders WHERE order_number = $1`,
          [order_number]
        );
        const st = existing.rows[0]?.status;
        if (!st) {
          results.push({ order_number, success: false, reason: "주문 없음" });
        } else if (st === "shipped" || st === "delivered") {
          // 이미 배송 단계인 주문은 운송장 정보만 갱신
          await client.query(
            `UPDATE orders SET tracking_company = $2, tracking_number = $3 WHERE order_number = $1`,
            [order_number, carrier || null, tracking_number]
          );
          results.push({ order_number, success: true });
        } else {
          // 취소/반품/교환 등 배송 불가 상태 — 조용히 넘기지 않고 실패로 보고
          results.push({ order_number, success: false, reason: `배송 불가 상태(${st})` });
        }
      } else {
        results.push({ order_number, success: true });
        if (updated[0]?.phone) {
          toNotify.push({
            order_number,
            name: updated[0].name || "",
            phone: updated[0].phone,
            carrier: carrier || null,
            tracking_number,
          });
        }
      }
    }

    await client.query("COMMIT");

    // 발송 안내 문자 — 배송 처리는 이미 확정됐으므로 문자 실패는 건수로만 보고 (처리를 막지 않음)
    let smsSent = 0;
    let smsFailed = 0;
    if (smsConfigured()) {
      for (const n of toNotify) {
        try {
          const r = await sendShipmentSMS(n.phone, {
            buyerName: n.name,
            orderNumber: n.order_number,
            carrier: n.carrier,
            trackingNumber: n.tracking_number,
          });
          if (r.ok) smsSent++;
          else { smsFailed++; console.error(`[shipments] 발송 문자 실패 ${n.order_number}:`, r.error); }
        } catch (e) {
          smsFailed++;
          console.error(`[shipments] 발송 문자 실패 ${n.order_number}:`, e);
        }
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);
    return NextResponse.json({ ok: true, succeeded, failed, smsSent, smsFailed });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("운송장 임포트 실패:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    client.release();
  }
}
