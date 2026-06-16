import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";

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
  trackingNumber: string,
  carrier: string
): Promise<{ delivered: boolean; statusText: string } | null> {
  const apiKey = process.env.SWEETTRACKER_API_KEY;
  if (!apiKey) return null;

  // 스위트트래커는 택배사 코드가 필요 — 이름 → 코드 매핑
  const carrierCode = resolveCarrierCode(carrier);

  try {
    const url = new URL("https://info.sweettracker.co.kr/api/v1/trackingInfo");
    url.searchParams.set("t_key", apiKey);
    url.searchParams.set("t_code", carrierCode);
    url.searchParams.set("t_invoice", trackingNumber);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.status === false) return null;

    // 배송완료 여부: level 6 = 배송완료
    const lastLevel = data.lastStateDetail?.level ?? 0;
    return {
      delivered: Number(lastLevel) >= 6,
      statusText: data.lastStateDetail?.text ?? "",
    };
  } catch {
    return null;
  }
}

// 택배사 코드 반환 — DB에 2자리 코드로 저장됨. 레거시 텍스트 대비 폴백 유지
function resolveCarrierCode(carrier: string): string {
  if (/^\d{2}$/.test(carrier)) return carrier; // 이미 코드면 그대로
  const c = (carrier ?? "").toLowerCase().replace(/\s/g, "");
  if (c.includes("cj") || c.includes("대한통운")) return "04";
  if (c.includes("롯데") || c.includes("lotte")) return "08";
  if (c.includes("한진") || c.includes("hanjin")) return "05";
  if (c.includes("우체국") || c.includes("epost") || c.includes("post")) return "01";
  if (c.includes("로젠") || c.includes("logen")) return "06";
  if (c.includes("gs") || c.includes("편의점")) return "26";
  if (c.includes("cu")) return "46";
  return "04";
}

// POST /api/admin/shipments/track
// 배송중(shipped) 주문 전체를 스위트트래커로 조회 → 배송완료된 건 자동 처리
export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  for (const order of shippedOrders) {
    const info = await fetchTrackingStatus(order.tracking_number, order.tracking_company ?? "");
    if (!info) {
      results.push({ order_number: order.order_number, status: "조회 실패" });
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
        `UPDATE orders SET status = 'delivered'
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
    results,
  });
}
