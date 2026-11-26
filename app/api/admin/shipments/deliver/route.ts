import { rollbackSafely, withApiErrors, readJsonObject, reportApiError, apiErrorResponse } from '@/lib/api-errors';
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
async function handlePATCH(req: Request) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const { orderIds, preparingIds = [] } = await readJsonObject(req);
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return NextResponse.json({ error: "주문 ID가 없습니다" }, { status: 400 });
    }
    if (!Array.isArray(preparingIds) || !preparingIds.every(id => orderIds.includes(id))) {
        return NextResponse.json({ error: "배송준비 주문 선택을 확인해주세요." }, { status: 400 });
    }
    if (!(await adminOrderIdsBelong(orderIds, site)))
        return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        const { rows: orders } = await client.query(`UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()), updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND site = $2 AND order_type IN ('shop', 'campaign')
         AND ((id = ANY($3::uuid[]) AND status = 'preparing')
           OR (id <> ALL($3::uuid[]) AND status = 'shipped'))
         AND NOT EXISTS (SELECT 1 FROM order_returns r WHERE r.order_id=orders.id AND r.status IN ('requested','collecting'))
       RETURNING id, order_number, total_amount, payment_method, payment_key`, [orderIds, site, preparingIds]);
        for (const order of orders) {
            await recordDeliverySettlement(client, order);
        }
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, updated: orders.length });
    }
    catch (e) {
        await rollbackSafely(client);
        reportApiError(e, 'app/api/admin/shipments/deliver/route.ts:43');
        return apiErrorResponse(e, { error: isRefundFulfillmentConflict(e) ? REFUND_FULFILLMENT_MESSAGE : "Internal server error" }, { status: isRefundFulfillmentConflict(e) ? 409 : 500 });
    }
    finally {
        client.release();
    }
}

export const PATCH = withApiErrors('PATCH /api/admin/shipments/deliver', handlePATCH);
