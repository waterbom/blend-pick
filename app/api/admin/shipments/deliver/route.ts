import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from '@/lib/refund-fulfillment';
import { currentAdminSite, adminOrderIdsBelong } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { recordDeliverySettlement } from "@/lib/delivery-settlement.cjs";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
// PATCH /api/admin/shipments/deliver
// body: { orderIds: string[] }
// → 배송완료 일괄 처리 + 정산 레코드 자동 생성
export async function PATCH(req: Request) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const { orderIds } = await req.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return NextResponse.json({ error: "주문 ID가 없습니다" }, { status: 400 });
    }
    if (!(await adminOrderIdsBelong(orderIds, site)))
        return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        const { rows: orders } = await client.query(`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW())
       WHERE id = ANY($1::uuid[]) AND site = $2 AND status = 'shipped'
       RETURNING id, order_number, total_amount, payment_method, payment_key`, [orderIds, site]);
        for (const order of orders) {
            await recordDeliverySettlement(client, order);
        }
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, updated: orders.length });
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error("배송완료 일괄 처리 실패:", e);
        return NextResponse.json({ error: isRefundFulfillmentConflict(e) ? REFUND_FULFILLMENT_MESSAGE : "Internal server error" }, { status: isRefundFulfillmentConflict(e) ? 409 : 500 });
    }
    finally {
        client.release();
    }
}
