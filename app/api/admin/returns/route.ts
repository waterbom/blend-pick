import { rollbackSafely, withApiErrors, readJsonObject, reportApiError, apiErrorResponse } from '@/lib/api-errors';
import { returnPaymentBalance } from '@/lib/return-payment';
import { bulkReturnAmount } from '@/lib/returns';
import { runRefund, RefundError } from '@/lib/refund-operation';
import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { smsConfigured } from "@/lib/sms";
import { sendReturnRefundSMS } from "@/lib/return-notify";

import {readReturnRange,readReturnListFilter} from '@/lib/admin-insights';
import {getReturnPage} from '@/lib/admin-insights-db';

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 교환·반품 신청 관리 — 4단계: requested(접수) → collecting(수거·처리 중) → done(완료) / rejected(거절)
// · 완료: orders.status를 exchange_completed / return_completed로. 반품은 이때 토스 부분 환불 실행.
// · 거절: 신청 전 주문 상태(prev_status)로 되돌려 고객이 다시 신청할 수 있게 한다.
// 모든 처리는 order_return_events에 관리자·시각과 함께 기록된다.

const refundQuoteColumns = `
  o.refund_amount_unresolved,
  EXISTS(SELECT 1 FROM refund_operations ro WHERE ro.order_id=o.id AND ro.status NOT IN ('completed','rejected')) AS pending_refunds,
  (SELECT COALESCE(SUM(amount), 0) FROM order_refund_amounts WHERE order_id=o.id) AS recorded_refunds,
  (SELECT CASE WHEN COUNT(*)=COUNT(ps.return_cost_roundtrip) THEN MAX(ps.return_cost_roundtrip) END
     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.items::jsonb)='array' THEN r.items::jsonb ELSE '[]'::jsonb END) item
     LEFT JOIN order_items oi ON oi.order_id=o.id AND oi.id::text=item->>'item_id'
     LEFT JOIN products_shop ps ON ps.id=COALESCE(oi.product_id,oi.product_ref)) AS return_cost_roundtrip`;

async function handleGET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const sp = new URL(req.url).searchParams;
  if (sp.has('page')) {
    const page=Number(sp.get('page'));
    const {range,error}=readReturnRange({returnsFrom:sp.get('from')??'',returnsTo:sp.get('to')??'',returnsKind:sp.get('kind')??'all'});
    const query=Object.fromEntries(['reason','status','duration'].filter(k=>sp.has(k)).map(k=>['returns'+k[0].toUpperCase()+k.slice(1),sp.get(k)]));
    const filter=range?readReturnListFilter(query,range):null;
    if (!Number.isSafeInteger(page)||page<1||page>1000000||!filter) return NextResponse.json({error:error||'분석 조회 조건이 올바르지 않습니다.'},{status:400});
    return NextResponse.json(await getReturnPage(site,filter,page));
  }
  const kind = sp.get("kind"); // exchange | return
  if (!["exchange", "return"].includes(kind || "")) {
    return NextResponse.json({ error: "kind가 필요합니다" }, { status: 400 });
  }
  // 기본은 진행 중(접수·수거)만 — 배송관리 신청 탭용
  const statuses = (sp.get("status") || "requested,collecting").split(",").map((v) => v.trim()).filter(Boolean);
  const requestId = sp.get("id");
  if (requestId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return NextResponse.json({ error: "신청 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const r = await shopPool.query(
    `SELECT r.id, r.order_id, r.kind, r.status, r.items, r.reason, r.detail, r.photos,
            r.pickup_address, r.pickup_detail, r.fee_agreed, r.prev_status,
            to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS created_kst,
            o.order_number, o.buyer_name, o.buyer_phone, o.recipient_name, o.recipient_phone,
            o.total_amount, COALESCE(o.shipping_fee, 0) AS shipping_fee, o.status AS order_status,
            ${refundQuoteColumns},
            (SELECT json_agg(json_build_object(
                      'status', e.status, 'note', e.note, 'admin_name', e.admin_name,
                      'at_kst', to_char(e.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'))
                    ORDER BY e.created_at)
               FROM order_return_events e WHERE e.return_id = r.id) AS events
       FROM order_returns r
       JOIN orders o ON o.id = r.order_id
      WHERE r.kind = $1 AND r.status = ANY($2) AND o.site = $3
        ${requestId ? "AND r.id = $4::uuid" : ""}
      ORDER BY r.created_at DESC
      ${requestId ? "LIMIT 1" : statuses.every(status => ["requested", "collecting"].includes(status)) ? "" : "LIMIT 200"}`,
    requestId ? [kind, statuses, site, requestId] : [kind, statuses, site]
  );
  return NextResponse.json(r.rows);
}

// PATCH { id, action: 'collect' | 'complete' | 'reject', note?, refund_amount? }
async function handlePATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = (await currentAdminSite()).key;

  const { id, action, note, refund_amount, bulk_reviewed } = await readJsonObject(req);
  if (!id || !["collect", "complete", "reject"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { rows } = await shopPool.query(
    `SELECT r.id, r.order_id, r.kind, r.status, r.prev_status, r.reason,
            o.status AS order_status, o.payment_key, o.total_amount,
            o.order_number, o.buyer_name, o.buyer_phone, o.site
       FROM order_returns r JOIN orders o ON o.id = r.order_id
      WHERE r.id = $1 AND o.site = $2`,
    [id, site]
  );
  const ret = rows[0];
  if (!ret) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  const adminName = admin.name || admin.email || "관리자";
  const noteText = String(note || "").slice(0, 500) || null;

  if (action === "collect") {
    if (ret.status !== "requested") {
      return NextResponse.json({ error: "접수 상태의 신청만 수거 처리할 수 있어요." }, { status: 409 });
    }
    const client = await shopPool.connect();
    try {
      await client.query("BEGIN");
      await client.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[ret.order_id]);
      const current=(await client.query('SELECT status FROM order_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
      const pending=await client.query("SELECT 1 FROM refund_operations WHERE order_id=$1 AND status NOT IN ('completed','rejected')",[ret.order_id]);
      if(!current || current.status!==ret.status || pending.rows.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({error:'신청 상태가 변경되었거나 환불 처리 중입니다.'},{status:409});
      }
      await client.query(`UPDATE order_returns SET status = 'collecting' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO order_return_events (return_id, status, note, admin_name) VALUES ($1, 'collecting', $2, $3)`,
        [id, noteText, adminName]
      );
      await client.query("COMMIT");
    } catch (e) {
      await rollbackSafely(client);
      reportApiError(e, 'app/api/admin/returns/route.ts:111');
      return apiErrorResponse(e, { error: "처리에 실패했어요." }, { status: 500 });
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, status: "collecting" });
  }

  if (!["requested", "collecting"].includes(ret.status)) {
    return NextResponse.json({ error: "이미 처리가 끝난 신청이에요." }, { status: 409 });
  }

  if (action === "complete") {
    let refunded = 0;
    let alreadyRefunded = false;
    const doneStatus = ret.kind === "exchange" ? "exchange_completed" : "return_completed";
    try {
      if (bulk_reviewed) {
        if (ret.kind !== 'return' || !Number.isSafeInteger(refund_amount) || refund_amount <= 0 ||
            !ret.payment_key || ret.payment_key.startsWith('SIM_')) throw new RefundError('일괄 환불 대상과 금액을 확인해주세요.',400);
        const balance = await returnPaymentBalance(ret.payment_key, Number(ret.total_amount));
        if (balance.canceled !== 0) throw new RefundError('기존 토스 환불 내역을 개별 확인해주세요.');
      }
      const result = await runRefund({sourceKey:`return:${id}`,orderId:ret.order_id,site,expectedAmount:bulk_reviewed ? refund_amount : undefined,
        prepare:async(client)=>{
          const current=(await client.query('SELECT status FROM order_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
          if(!current || !['requested','collecting'].includes(current.status)) throw new RefundError('이미 처리가 끝난 신청이에요.');
          if (bulk_reviewed) {
            const quote = (await client.query(`SELECT r.items,r.fee_agreed,o.status AS order_status,o.total_amount,
              ${refundQuoteColumns} FROM order_returns r JOIN orders o ON o.id=r.order_id WHERE r.id=$1`,[id])).rows[0];
            if (bulkReturnAmount(quote) !== refund_amount) throw new RefundError('주문 상태 또는 환불 금액이 변경되었습니다. 신청을 다시 확인해주세요.',409);
          }
          const amount=ret.kind==='return'?Number(refund_amount):0;
          if(!Number.isSafeInteger(amount)||amount<0)throw new RefundError('환불 금액을 0 이상의 정수로 입력해주세요.',400);
          return {amount,reason:`반품 환불 (${ret.reason})`};
        },
        apply:async(client,_order,amount)=>{
          const current=(await client.query('SELECT status FROM order_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
          if(!current || !['requested','collecting'].includes(current.status)) throw new RefundError('신청 상태를 확인해주세요.');
          await client.query(`UPDATE order_returns SET status = 'done' WHERE id = $1`,[id]);
          await client.query(`INSERT INTO order_return_events (return_id,status,note,admin_name) VALUES($1,'done',$2,$3)`,[id,amount>0?`${amount.toLocaleString()}원 환불${noteText?` — ${noteText}`:''}`:noteText,adminName]);
          await client.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2',[doneStatus,ret.order_id]);
        }});
      refunded=result.amount;
      alreadyRefunded=result.alreadyCompleted;
    } catch(e) {
      reportApiError(e, 'app/api/admin/returns/route.ts:146');
      return apiErrorResponse(e, {error:e instanceof RefundError?e.message:'완료 저장에 실패했습니다. 같은 신청에서 다시 확인해주세요.'},{status:e instanceof RefundError?e.status:500});
    }

    // 반품 환불 안내 문자 — 완료 처리 후 발송 (실패해도 완료 자체는 유지)
    let smsSent = false;
    if (ret.kind === "return" && !alreadyRefunded && refunded > 0 && ret.buyer_phone && smsConfigured()) {
      try {
        const r = await sendReturnRefundSMS(ret.buyer_phone, {
          buyerName: ret.buyer_name,
          orderNumber: ret.order_number,
          refundAmount: refunded,
          site: ret.site,
        });
        smsSent = r.ok === true;
      } catch (e) {
        reportApiError(e, 'app/api/admin/returns/route.ts:162');
      }
    }

    return NextResponse.json({ ok: true, status: "done", refunded, smsSent, alreadyRefunded });
  }

  // reject — 주문 상태를 신청 전으로 되돌려 재신청 가능하게
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
      await client.query('SELECT id FROM orders WHERE id=$1 FOR UPDATE',[ret.order_id]);
      const current=(await client.query('SELECT status FROM order_returns WHERE id=$1 FOR UPDATE',[id])).rows[0];
      const pending=await client.query("SELECT 1 FROM refund_operations WHERE order_id=$1 AND status NOT IN ('completed','rejected')",[ret.order_id]);
      if(!current || current.status!==ret.status || pending.rows.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({error:'신청 상태가 변경되었거나 환불 처리 중입니다.'},{status:409});
      }
    await client.query(`UPDATE order_returns SET status = 'rejected' WHERE id = $1`, [id]);
    await client.query(
      `INSERT INTO order_return_events (return_id, status, note, admin_name) VALUES ($1, 'rejected', $2, $3)`,
      [id, noteText, adminName]
    );
    // 신청으로 바뀐 상태(exchange_requested/return_requested)일 때만 복원 — 다른 상태면 건드리지 않음
    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
        WHERE id = $2 AND status IN ('exchange_requested', 'return_requested')`,
      [ret.prev_status || "delivered", ret.order_id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await rollbackSafely(client);
    reportApiError(e, 'app/api/admin/returns/route.ts:194');
    return apiErrorResponse(e, { error: "처리에 실패했어요." }, { status: 500 });
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true, status: "rejected" });
}

export const GET = withApiErrors('GET /api/admin/returns', handleGET);
export const PATCH = withApiErrors('PATCH /api/admin/returns', handlePATCH);
