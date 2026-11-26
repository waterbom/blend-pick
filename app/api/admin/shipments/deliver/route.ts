import { rollbackSafely, withApiErrors, readJsonObject, reportApiError, apiErrorResponse } from "@/lib/api-errors";
import { isRefundFulfillmentConflict, REFUND_FULFILLMENT_MESSAGE } from "@/lib/refund-fulfillment";
import { currentAdminSite, adminOrderIdsBelong } from "@/lib/admin-site";
import { isDirectDeliveryReason, type DeliveryResult } from "@/lib/delivery-completion";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { recordDeliverySettlement } from "@/lib/delivery-settlement.cjs";

async function handlePATCH(req: Request) {
  const token = (await cookies()).get("admin_token")?.value;
  const admin = token ? await verifyAdminToken(token) : null;
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;
  const input = await readJsonObject(req);
  const { orderIds, mode = "shipped", directReason, preparingIds, receiptConfirmed } = input;
  if (!Array.isArray(orderIds) || !orderIds.length || orderIds.length > 200
    || orderIds.some(id => typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "배송 주문을 1~200건 선택해주세요." }, { status: 400 });
  }
  if ((input.mode !== undefined && receiptConfirmed !== true) || (mode !== "shipped" && mode !== "direct")
    || (preparingIds !== undefined && (!Array.isArray(preparingIds) || preparingIds.length > 0))
    || (mode === "direct" ? orderIds.length !== 1 || !isDirectDeliveryReason(directReason) : directReason !== undefined)) {
    return NextResponse.json({ error: "배송중 일괄 완료와 직접 전달 완료는 따로 처리해주세요. 직접 전달은 주문 1건과 수령 사유를 선택해주세요." }, { status: 400 });
  }
  const ids = [...new Set(orderIds.map(id => id.toLowerCase()))];
  if (!(await adminOrderIdsBelong(ids, site))) return NextResponse.json({ error: "이 사이트의 주문을 찾을 수 없습니다." }, { status: 404 });

  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      SELECT id, order_number, order_type, status, tracking_company, tracking_number, shipped_at
        FROM orders WHERE site=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE
    `, [site, ids]);
    const byId = new Map(rows.map(order => [order.id, order]));
    const results: DeliveryResult[] = [];
    let refundConflicts = 0;
    for (const id of ids) {
      const order = byId.get(id);
      const item = { id, orderNumber: order?.order_number ?? "" };
      if (!order || !["shop", "campaign"].includes(order.order_type)) {
        results.push({ ...item, result: "skipped", reason: "처리 가능한 상품 주문이 아닙니다." });
        continue;
      }
      if (order.status !== (mode === "direct" ? "preparing" : "shipped")) {
        results.push({ ...item, result: "skipped", reason: order.status === "delivered"
          ? "이미 배송완료된 주문입니다." : "주문 상태가 바뀌었습니다. 새로고침 후 확인해주세요." });
        continue;
      }
      if (mode === "direct" && (order.tracking_number?.trim() || order.tracking_company?.trim() || order.shipped_at)) {
        results.push({ ...item, result: "skipped", reason: "기존 발송 정보가 있어 직접 전달로 처리할 수 없습니다." });
        continue;
      }
      await client.query("SAVEPOINT delivery_row");
      try {
        const { rows: updated } = await client.query(`
          UPDATE orders SET status='delivered', delivered_at=COALESCE(delivered_at,NOW()), updated_at=NOW(),
            direct_delivery_reason=$3, direct_delivery_confirmed_by=$4
          WHERE id=$1 AND site=$2 AND status=$5
            AND NOT EXISTS(SELECT 1 FROM order_returns r WHERE r.order_id=orders.id AND r.status IN ('requested','collecting'))
          RETURNING id, order_number, total_amount, payment_method, payment_key
        `, [id, site, mode === "direct" ? directReason : null,
          mode === "direct" ? (admin.name || admin.email || "관리자") : null,
          mode === "direct" ? "preparing" : "shipped"]);
        if (!updated.length) {
          results.push({ ...item, result: "skipped", reason: "진행 중인 교환·반품이 있어 완료할 수 없습니다." });
        } else {
          await recordDeliverySettlement(client, updated[0]);
          results.push({ ...item, result: "completed" });
        }
      } catch (cause) {
        await client.query("ROLLBACK TO SAVEPOINT delivery_row");
        if (!isRefundFulfillmentConflict(cause)) throw cause;
        refundConflicts++;
        results.push({ ...item, result: "failed", reason: REFUND_FULFILLMENT_MESSAGE });
      }
      await client.query("RELEASE SAVEPOINT delivery_row");
    }
    await client.query("COMMIT");
    const updated = results.filter(r => r.result === "completed").length;
    const failed = results.filter(r => r.result === "failed").length;
    return NextResponse.json({ ok: failed === 0, updated, failed, skipped: results.length - updated - failed, results },
      { status: !updated && refundConflicts ? 409 : 200 });
  } catch (cause) {
    await rollbackSafely(client);
    reportApiError(cause, "admin.shipments.deliver");
    return apiErrorResponse(cause, { error: "배송완료 처리를 저장하지 못했습니다. 목록에서 현재 상태를 확인해주세요." }, { status: 500 });
  } finally {
    client.release();
  }
}

export const PATCH = withApiErrors("PATCH /api/admin/shipments/deliver", handlePATCH);
