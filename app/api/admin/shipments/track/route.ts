import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { toCarrierCode } from "@/lib/carriers";

const FEE_RATE: Record<string, number> = {
  card: 0.0363,
  transfer: 0.0165,
};

async function getAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 스위트트래커 배송 상태 조회
async function fetchTrackingStatus(
  apiKey: string,
  trackingNumber: string,
  carrierCode: string
): Promise<{ delivered: boolean; statusText: string } | { error: string }> {
  try {
    const url = new URL("https://info.sweettracker.co.kr/api/v1/trackingInfo");
    url.searchParams.set("t_key", apiKey);
    url.searchParams.set("t_code", carrierCode);
    url.searchParams.set("t_invoice", trackingNumber);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const data = await res.json();
    // 스마트택배는 실패도 200으로 주고 msg에 사유를 담는다 (사용량 초과, 잘못된 운송장 등)
    if (!data || data.status === false) return { error: data?.msg || "조회 실패" };

    // 배송완료 여부: level 6 = 배송완료
    const lastLevel = data.lastStateDetail?.level ?? 0;
    return {
      delivered: Number(lastLevel) >= 6,
      statusText: data.lastStateDetail?.text ?? "",
    };
  } catch {
    return { error: "네트워크 오류" };
  }
}

// POST /api/admin/shipments/track
// 배송중(shipped) 주문 전체를 스위트트래커로 조회 → 배송완료된 건 자동 처리
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SWEETTRACKER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SWEETTRACKER_API_KEY가 서버에 설정되지 않았습니다. 스마트택배 API 키를 발급받아 .env.local에 등록하세요." },
      { status: 400 }
    );
  }

  // shipped 상태인 주문 중 운송장번호 있는 것만 조회
  const { rows: shippedOrders } = await shopPool.query(`
    SELECT id, order_number, tracking_company, tracking_number, total_amount, payment_method, payment_key
    FROM orders
    WHERE status = 'shipped' AND tracking_number IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 100
  `);

  if (shippedOrders.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, delivered: 0 });
  }

  const deliveredIds: string[] = [];
  const results: { order_number: string; status: string }[] = [];
  let attempted = 0, failed = 0;
  let firstError: string | null = null;

  for (const order of shippedOrders) {
    const code = toCarrierCode(order.tracking_company);
    if (!code) {
      results.push({ order_number: order.order_number, status: `택배사 미인식 (${order.tracking_company ?? "없음"}) — 운송장 다시 등록 필요` });
      continue;
    }
    attempted++;
    const info = await fetchTrackingStatus(apiKey, order.tracking_number, code);
    if ("error" in info) {
      failed++;
      if (!firstError) firstError = info.error;
      results.push({ order_number: order.order_number, status: `조회 실패 — ${info.error}` });
      continue;
    }
    results.push({ order_number: order.order_number, status: info.statusText || (info.delivered ? "배송완료" : "배송중") });
    if (info.delivered) deliveredIds.push(order.id);
  }

  // 배송완료된 주문 일괄 처리
  if (deliveredIds.length > 0) {
    const client = await shopPool.connect();
    try {
      await client.query("BEGIN");

      const { rows: updated } = await client.query(
        `UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = ANY($1::uuid[]) AND status = 'shipped'
         RETURNING id, order_number, total_amount, payment_method, payment_key`,
        [deliveredIds]
      );

      for (const order of updated) {
        const existing = await client.query(
          `SELECT id FROM settlements WHERE order_id = $1`,
          [order.id]
        );
        if (existing.rows.length > 0) continue;

        const method = order.payment_method || "card";
        const rate = FEE_RATE[method] ?? FEE_RATE["card"];
        const gross = Number(order.total_amount);
        const fee = Math.round(gross * rate);
        const net = gross - fee;

        await client.query(
          `INSERT INTO settlements (payment_key, order_id, gross_amount, fee, net_amount, settled_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [order.payment_key || `auto_${order.order_number}`, order.id, gross, fee, net]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("자동 배송완료 처리 실패:", e);
    } finally {
      client.release();
    }
  }

  return NextResponse.json({
    ok: true,
    checked: shippedOrders.length,
    delivered: deliveredIds.length,
    failed,
    // 시도한 조회가 전부 같은 이유로 실패하면 API 자체 문제 (사용량 초과 등) — 화면에서 알림
    apiError: attempted > 0 && failed === attempted ? firstError : null,
    results,
  });
}
