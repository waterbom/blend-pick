import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import shopPool from "@/lib/db-shop";
import { smsConfigured } from "@/lib/sms";
import { sendReturnRefundSMS } from "@/lib/return-notify";

async function getAdmin() {
  const token = (await cookies()).get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// 교환·반품 신청 관리 — 4단계: requested(접수) → collecting(수거·처리 중) → done(완료) / rejected(거절)
// · 완료: orders.status를 exchange_completed / return_completed로. 반품은 이때 토스 부분 환불 실행.
// · 거절: 신청 전 주문 상태(prev_status)로 되돌려 고객이 다시 신청할 수 있게 한다.
// 모든 처리는 order_return_events에 관리자·시각과 함께 기록된다.

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind"); // exchange | return
  if (!["exchange", "return"].includes(kind || "")) {
    return NextResponse.json({ error: "kind가 필요합니다" }, { status: 400 });
  }
  // 기본은 진행 중(접수·수거)만 — 배송관리 신청 탭용
  const statuses = (sp.get("status") || "requested,collecting").split(",").map((v) => v.trim()).filter(Boolean);

  const r = await shopPool.query(
    `SELECT r.id, r.order_id, r.kind, r.status, r.items, r.reason, r.detail, r.photos,
            r.pickup_address, r.pickup_detail, r.fee_agreed, r.prev_status,
            to_char(r.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS created_kst,
            o.order_number, o.buyer_name, o.buyer_phone, o.recipient_name, o.recipient_phone,
            o.total_amount, COALESCE(o.shipping_fee, 0) AS shipping_fee, o.status AS order_status,
            -- 주문 상품에 등록된 반품 왕복비 (단순변심 환불 기본값 계산용 — 상품별로 다르면 큰 값)
            (SELECT COALESCE(MAX(ps.return_cost_roundtrip), 0)
               FROM order_items oi JOIN products_shop ps ON ps.id = oi.product_id
              WHERE oi.order_id = r.order_id) AS return_cost_roundtrip,
            (SELECT json_agg(json_build_object(
                      'status', e.status, 'note', e.note, 'admin_name', e.admin_name,
                      'at_kst', to_char(e.created_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'))
                    ORDER BY e.created_at)
               FROM order_return_events e WHERE e.return_id = r.id) AS events
       FROM order_returns r
       JOIN orders o ON o.id = r.order_id
      WHERE r.kind = $1 AND r.status = ANY($2)
      ORDER BY r.created_at DESC
      LIMIT 200`,
    [kind, statuses]
  );
  return NextResponse.json(r.rows);
}

// PATCH { id, action: 'collect' | 'complete' | 'reject', note?, refund_amount? }
export async function PATCH(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, note, refund_amount } = await req.json();
  if (!id || !["collect", "complete", "reject"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const { rows } = await shopPool.query(
    `SELECT r.id, r.order_id, r.kind, r.status, r.prev_status, r.reason,
            o.status AS order_status, o.payment_key, o.total_amount,
            o.order_number, o.buyer_name, o.buyer_phone, o.site
       FROM order_returns r JOIN orders o ON o.id = r.order_id
      WHERE r.id = $1`,
    [id]
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
      await client.query(`UPDATE order_returns SET status = 'collecting' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO order_return_events (return_id, status, note, admin_name) VALUES ($1, 'collecting', $2, $3)`,
        [id, noteText, adminName]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[returns] 수거 처리 실패:", e);
      return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, status: "collecting" });
  }

  if (!["requested", "collecting"].includes(ret.status)) {
    return NextResponse.json({ error: "이미 처리가 끝난 신청이에요." }, { status: 409 });
  }

  if (action === "complete") {
    // 반품 완료 = 환불 실행 시점 — 환불 성공 후에만 상태를 바꾼다 (취소 엔진과 같은 순서)
    let refunded = 0;
    let alreadyRefunded = false; // 이전 시도에서 토스 환불만 성공하고 완료 처리가 안 된 건
    if (ret.kind === "return") {
      const amount = Math.floor(Number(refund_amount)) || 0;
      if (amount < 0 || amount > Number(ret.total_amount)) {
        return NextResponse.json({ error: "환불 금액이 결제 금액을 벗어났어요." }, { status: 400 });
      }
      if (amount > 0 && ret.payment_key && !String(ret.payment_key).startsWith("SIM_")) {
        const secretKey = process.env.TOSS_SECRET_KEY;
        const auth = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
        const body: Record<string, unknown> = { cancelReason: `반품 환불 (${ret.reason})` };
        if (amount < Number(ret.total_amount)) body.cancelAmount = amount;
        const tossRes = await fetch(
          `https://api.tosspayments.com/v1/payments/${ret.payment_key}/cancel`,
          {
            method: "POST",
            headers: { Authorization: auth, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!tossRes.ok) {
          const e = await tossRes.json().catch(() => ({}));
          if (e.code === "ALREADY_CANCELED_PAYMENT") {
            alreadyRefunded = true; // 전액 이미 취소된 결제 — 완료 처리만 진행
          } else if (e.code === "NOT_CANCELABLE_AMOUNT") {
            // 잔액 부족 — 이전 시도에서 같은 금액이 '반품 환불'로 이미 취소됐는지 확인하고,
            // 맞으면 이중 환불 없이 완료 처리만 이어서 진행한다
            const payRes = await fetch(
              `https://api.tosspayments.com/v1/payments/${ret.payment_key}`,
              { headers: { Authorization: auth } }
            );
            const pay = await payRes.json().catch(() => ({}));
            const cancels: { cancelAmount: number; cancelReason?: string }[] = Array.isArray(pay.cancels) ? pay.cancels : [];
            const sameRefund = cancels.some(
              (c) => Number(c.cancelAmount) === amount && String(c.cancelReason || "").startsWith("반품 환불")
            );
            if (sameRefund) {
              alreadyRefunded = true;
            } else {
              const balance = Number(pay.balanceAmount);
              return NextResponse.json(
                {
                  error:
                    `토스 취소 가능 잔액이 부족해요` +
                    (Number.isFinite(balance) ? ` (잔액 ${balance.toLocaleString()}원)` : "") +
                    `. 이미 취소된 내역이 있는 결제예요 — 잔액 이하 금액으로 다시 입력하거나, 0원으로 완료 처리하세요.`,
                },
                { status: 400 }
              );
            }
          } else {
            return NextResponse.json(
              { error: e.message || "토스 환불에 실패했어요. 신청 상태는 그대로예요." },
              { status: 400 }
            );
          }
        }
      }
      refunded = amount;
    }

    const doneStatus = ret.kind === "exchange" ? "exchange_completed" : "return_completed";
    const client = await shopPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE order_returns SET status = 'done' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO order_return_events (return_id, status, note, admin_name) VALUES ($1, 'done', $2, $3)`,
        [
          id,
          refunded > 0
            ? `${refunded.toLocaleString()}원 환불${alreadyRefunded ? " (기존 토스 취소 확인 — 재환불 없음)" : ""}${noteText ? ` — ${noteText}` : ""}`
            : noteText,
          adminName,
        ]
      );
      await client.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
        [doneStatus, ret.order_id]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[returns] 완료 처리 실패 (환불은 실행됐을 수 있음):", e);
      return NextResponse.json({ error: "완료 처리 중 오류 — 목록을 새로고침해 확인해주세요." }, { status: 500 });
    } finally {
      client.release();
    }

    // 반품 환불 안내 문자 — 완료 처리 후 발송 (실패해도 완료 자체는 유지)
    let smsSent = false;
    if (ret.kind === "return" && refunded > 0 && ret.buyer_phone && smsConfigured()) {
      try {
        const r = await sendReturnRefundSMS(ret.buyer_phone, {
          buyerName: ret.buyer_name,
          orderNumber: ret.order_number,
          refundAmount: refunded,
          site: ret.site,
        });
        smsSent = r.ok === true;
      } catch (e) {
        console.error("[returns] 환불 안내 문자 발송 실패:", e);
      }
    }

    return NextResponse.json({ ok: true, status: "done", refunded, smsSent, alreadyRefunded });
  }

  // reject — 주문 상태를 신청 전으로 되돌려 재신청 가능하게
  const client = await shopPool.connect();
  try {
    await client.query("BEGIN");
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
    await client.query("ROLLBACK");
    console.error("[returns] 거절 처리 실패:", e);
    return NextResponse.json({ error: "처리에 실패했어요." }, { status: 500 });
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true, status: "rejected" });
}
