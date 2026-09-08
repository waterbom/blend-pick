import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from '@/lib/refund-fulfillment';
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { toCarrierCode } from "@/lib/carriers";
import { recordDeliverySettlement } from "@/lib/delivery-settlement.cjs";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
// 스위트트래커 배송 상태 조회
async function fetchTrackingStatus(apiKey: string, trackingNumber: string, carrierCode: string): Promise<{
    delivered: boolean;
    statusText: string;
} | {
    error: string;
}> {
    try {
        const url = new URL("https://info.sweettracker.co.kr/api/v1/trackingInfo");
        url.searchParams.set("t_key", apiKey);
        url.searchParams.set("t_code", carrierCode);
        url.searchParams.set("t_invoice", trackingNumber);
        const res = await fetch(url.toString(), { next: { revalidate: 0 } });
        if (!res.ok)
            return { error: `HTTP ${res.status}` };
        const data = await res.json();
        // 스마트택배는 실패도 200으로 주고 msg에 사유를 담는다 (사용량 초과, 잘못된 운송장 등)
        if (!data || data.status === false)
            return { error: data?.msg || "조회 실패" };
        // 배송완료 여부: level 6 = 배송완료
        const lastLevel = data.lastStateDetail?.level ?? 0;
        return {
            delivered: Number(lastLevel) >= 6,
            statusText: data.lastStateDetail?.text ?? "",
        };
    }
    catch {
        return { error: "네트워크 오류" };
    }
}
// POST /api/admin/shipments/track
// 배송중(shipped) 주문 전체를 스위트트래커로 조회 → 배송완료된 건 자동 처리
export async function POST() {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const apiKey = process.env.SWEETTRACKER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "SWEETTRACKER_API_KEY가 서버에 설정되지 않았습니다. 스마트택배 API 키를 발급받아 .env.local에 등록하세요." }, { status: 400 });
    }
    // shipped 상태인 주문 중 운송장번호 있는 것만 조회
    const { rows: shippedOrders } = await shopPool.query(`
    SELECT id, order_number, tracking_company, tracking_number, total_amount, payment_method, payment_key
    FROM orders
    WHERE site = $1 AND status = 'shipped' AND tracking_number IS NOT NULL
    ORDER BY tracking_checked_at ASC NULLS FIRST, created_at ASC
    LIMIT 100
  `, [site]);
    if (shippedOrders.length === 0) {
        return NextResponse.json({ ok: true, checked: 0, delivered: 0 });
    }
    let committed = 0, writeFailed = false;
    const deliveredIds: string[] = [];
    const results: {
        order_number: string;
        status: string;
    }[] = [];
    let attempted = 0, failed = 0;
    let firstError: string | null = null;
    for (const order of shippedOrders) {
        await shopPool.query("UPDATE orders SET tracking_checked_at=NOW() WHERE id=$1 AND site=$2", [order.id, site]);
        const code = toCarrierCode(order.tracking_company);
        if (!code) {
            failed++;
            results.push({ order_number: order.order_number, status: `택배사 미인식 (${order.tracking_company ?? "없음"}) — 운송장 다시 등록 필요` });
            continue;
        }
        attempted++;
        const info = await fetchTrackingStatus(apiKey, order.tracking_number, code);
        if ("error" in info) {
            failed++;
            if (!firstError)
                firstError = info.error;
            results.push({ order_number: order.order_number, status: `조회 실패 — ${info.error}` });
            continue;
        }
        results.push({ order_number: order.order_number, status: info.statusText || (info.delivered ? "배송완료" : "배송중") });
        if (info.delivered)
            deliveredIds.push(order.id);
    }
    // 배송완료된 주문 일괄 처리
    if (deliveredIds.length > 0) {
        const client = await shopPool.connect();
        try {
            await client.query("BEGIN");
            const { rows: updated } = await client.query(`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
         WHERE id = ANY($1::uuid[]) AND site = $2 AND status = 'shipped'
         RETURNING id, order_number, total_amount, payment_method, payment_key`, [deliveredIds, site]);
            for (const order of updated) {
                await recordDeliverySettlement(client, order);
            }
            await client.query("COMMIT");
            committed = updated.length;
        }
        catch (e) {
            await client.query("ROLLBACK");
            writeFailed = true;
            failed += deliveredIds.length;
            results.push({ order_number: "", status: isRefundFulfillmentConflict(e) ? REFUND_FULFILLMENT_MESSAGE : "배송 완료 저장 실패 — 재시도 필요" });
            console.error("자동 배송완료 처리 실패:", e);
        }
        finally {
            client.release();
        }
    }
    return NextResponse.json({
        ok: failed === 0 && !writeFailed,
        checked: shippedOrders.length,
        delivered: committed,
        writeFailed,
        failed,
        // 시도한 조회가 전부 같은 이유로 실패하면 API 자체 문제 (사용량 초과 등) — 화면에서 알림
        apiError: attempted > 0 && failed === attempted ? firstError : null,
        results,
    }, { status: writeFailed ? 503 : 200 });
}
