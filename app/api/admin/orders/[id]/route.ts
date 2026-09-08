import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from '@/lib/refund-fulfillment';
import { currentAdminSite, adminOrderIdsBelong } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { cancelShopOrder } from "@/lib/order-cancel";
import { recordDeliverySettlement } from "@/lib/delivery-settlement.cjs";
async function getAdmin() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token)
        return null;
    return verifyAdminToken(token);
}
// PATCH /api/admin/orders/[id] — 주문 상태 변경
// body: { status: "preparing" | "shipped" | "delivered" | "cancelled" }
export async function PATCH(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const admin = await getAdmin();
    if (!admin)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const { id } = await params;
    const { action, status, tracking_company, tracking_number } = await request.json();
    if (!(await adminOrderIdsBelong([id], site)))
        return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });
    // 배송중 누락 보완은 상태 전환·문자·정산 없이 송장 두 필드만 변경한다.
    if (action === "repair_tracking") {
        if (typeof tracking_company !== "string" || typeof tracking_number !== "string" ||
            !tracking_company.trim() || !tracking_number.trim() ||
            tracking_company.length > 100 || tracking_number.length > 100) {
            return NextResponse.json({ error: "택배사와 운송장번호를 모두 입력해주세요." }, { status: 400 });
        }
        try {
        const result = await shopPool.query(`UPDATE orders SET tracking_company = $1, tracking_number = $2
       WHERE id = $3 AND site = $4 AND status = 'shipped'
         AND (NULLIF(TRIM(tracking_company), '') IS NULL OR NULLIF(TRIM(tracking_number), '') IS NULL)
       RETURNING id`, [tracking_company.trim(), tracking_number.trim(), id, site]);
        if (!result.rows.length)
            return NextResponse.json({ error: "주문 상태나 송장 정보가 바뀌었습니다. 새로고침해 확인해주세요." }, { status: 409 });
        return NextResponse.json({ ok: true });
        } catch (error) {
          if (isRefundFulfillmentConflict(error)) return NextResponse.json({error:REFUND_FULFILLMENT_MESSAGE},{status:409});
          throw error;
        }
    }
    if (status === 'cancelled') {
        const result = await cancelShopOrder(id, '관리자 주문 취소', { site });
        return NextResponse.json(result, result.ok ? undefined : { status: result.httpStatus });
    }
    const transitions: Record<string, string[]> = { confirmed: ['paid'], preparing: ['paid', 'confirmed'], shipped: ['paid', 'confirmed', 'preparing'], delivered: ['shipped'], cancel_requested: ['paid', 'confirmed', 'preparing'] };
    if (!transitions[status])
        return NextResponse.json({ error: '해당 처리는 교환·반품 신청 상세에서 진행해주세요.' }, { status: 409 });
    const client = await shopPool.connect();
    try {
        await client.query("BEGIN");
        // 취소 전환 시 재고 복원용 — 이전 상태 확인 (이미 취소된 주문은 중복 복원 방지)
        const prev = await client.query(`SELECT status FROM orders WHERE id = $1 AND site = $2 FOR UPDATE`, [id, site]);
        const prevStatus = prev.rows[0]?.status;
        if (!transitions[status].includes(prevStatus)) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: '현재 주문 상태에서 변경할 수 없습니다.' }, { status: 409 });
        }
        // 주문 상태 변경 (운송장 정보 있으면 함께 저장)
        const { rows } = await client.query(`UPDATE orders
       SET status = $1,
           shipped_at   = CASE WHEN $1 = 'shipped'   THEN COALESCE(shipped_at, NOW())   ELSE shipped_at END,
           delivered_at = CASE WHEN $1 = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
           tracking_company = COALESCE($3, tracking_company),
           tracking_number  = COALESCE($4, tracking_number)
       WHERE id = $2 AND site = $5
       RETURNING id, order_number, total_amount, payment_method, payment_key`, [status, id, tracking_company ?? null, tracking_number ?? null, site]);
        if (rows.length === 0) {
            await client.query("ROLLBACK");
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        const order = rows[0];
        if (status === 'delivered')
            await recordDeliverySettlement(client, order);
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, status });
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error("주문 상태 변경 실패:", e);
        return NextResponse.json({ error: isRefundFulfillmentConflict(e) ? REFUND_FULFILLMENT_MESSAGE : "Internal server error" }, { status: isRefundFulfillmentConflict(e) ? 409 : 500 });
    }
    finally {
        client.release();
    }
}
