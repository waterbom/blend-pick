import shopPool from '@/lib/db-shop';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import type { SiteKey } from '@/lib/sites';

export class RefundError extends Error {
    constructor(message: string, public status = 409) { super(message); }
}
type Order = {id:string;site:SiteKey;status:string;order_type:string;total_amount:number;shipping_fee:number|null;payment_key:string|null};
type Operation = { source_key: string; order_id: string; amount: number; baseline: number; reason: string;
    payment_key: string | null; total: number; idempotency_key: string; status: string;
    actual_amount: number | null; first_sent_at: string | null; lease_until: string | null };
type Spec = { sourceKey: string; orderId: string; site?: SiteKey;
    prepare: (c: PoolClient, o: Order) => Promise<{ amount: number; reason: string }>;
    apply: (c: PoolClient, o: Order, amount: number) => Promise<void> };

// The intent is committed BEFORE PG. PG success is committed BEFORE fulfillment changes.
// A retry uses the stored amount/body/key, even if the caller changes its form values.
export async function runRefund(spec: Spec) {
    const c = await shopPool.connect();
    let op: Operation;
    try {
        await c.query('BEGIN');
        const o = (await c.query('SELECT * FROM orders WHERE id=$1 AND ($2::text IS NULL OR site=$2) FOR UPDATE', [spec.orderId,spec.site??null])).rows[0];
        if (!o) throw new RefundError('주문을 찾을 수 없습니다.',404);
        const prior = (await c.query('SELECT * FROM refund_operations WHERE source_key=$1', [spec.sourceKey])).rows[0] as Operation | undefined;
        if (prior?.order_id && prior.order_id !== spec.orderId) throw new RefundError('환불 주문 정보가 다릅니다.');
        if (prior?.status === 'completed') { await c.query('COMMIT'); return { amount:Number(prior.actual_amount), alreadyCompleted:true }; }
        if (prior?.lease_until && new Date(prior.lease_until).getTime() > Date.now()) throw new RefundError('환불 처리 중입니다. 잠시 후 다시 확인해주세요.');
        if (prior?.status === 'rejected') throw new RefundError('결제사에서 거절한 환불입니다. 결제사 내역을 확인해주세요.');
        if (!prior) {
            const other = await c.query("SELECT 1 FROM refund_operations WHERE order_id=$1 AND status NOT IN ('completed','rejected')",[spec.orderId]);
            if (other.rows.length) throw new RefundError('다른 환불 작업을 먼저 완료해주세요.');
            const plan = await spec.prepare(c,o);
            const baseline = Number((await c.query('SELECT COALESCE(SUM(amount),0) amount FROM order_refund_amounts WHERE order_id=$1',[spec.orderId])).rows[0].amount);
            if (!Number.isSafeInteger(plan.amount) || plan.amount < 0 || plan.amount+baseline > Number(o.total_amount)) throw new RefundError('환불 금액이 남은 결제 금액을 벗어났습니다.',400);
            if (plan.amount>0 && (!o.payment_key || String(o.payment_key).startsWith('SIM_'))) throw new RefundError('실제 결제 내역을 확인할 수 없습니다.');
            op = (await c.query(`INSERT INTO refund_operations(source_key,order_id,amount,baseline,reason,payment_key,total,idempotency_key)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[spec.sourceKey,spec.orderId,plan.amount,baseline,plan.reason,o.payment_key,o.total_amount,randomUUID()])).rows[0];
        } else op = prior;
        await c.query("UPDATE refund_operations SET lease_until=NOW()+INTERVAL '2 minutes',updated_at=NOW() WHERE source_key=$1",[spec.sourceKey]);
        await c.query('COMMIT');
    } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }

    try {
        if (op.status !== 'succeeded') {
            let actual = 0;
            if (Number(op.amount)>0) {
                // Toss keeps idempotency responses for 15 days. Never resend an uncertain old operation.
                if (op.first_sent_at && Date.now()-new Date(op.first_sent_at).getTime() >= 14*86400000)
                    throw new RefundError('오래된 환불 요청입니다. 결제사 환불 내역을 대조해야 합니다.');
                await shopPool.query("UPDATE refund_operations SET status='processing',first_sent_at=COALESCE(first_sent_at,NOW()) WHERE source_key=$1",[spec.sourceKey]);
                const auth = `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`;
                const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(op.payment_key!)}/cancel`,{
                    method:'POST',headers:{Authorization:auth,'Content-Type':'application/json','Idempotency-Key':op.idempotency_key},
                    body:JSON.stringify({cancelReason:op.reason,cancelAmount:Number(op.amount)}),signal:AbortSignal.timeout(20000)});
                const data = await res.json();
                if (!res.ok) {
                    // Do not infer success from an unrelated historical cancellation.
                    throw new RefundError(data.message || '환불 결과 확인이 필요합니다. 같은 요청에서 다시 확인해주세요.',res.status>=500?503:400);
                }
                if (data.paymentKey !== op.payment_key || Number(data.totalAmount)!==Number(op.total) ||
                    !['CANCELED','PARTIAL_CANCELED'].includes(data.status) || !Number.isSafeInteger(data.balanceAmount) || data.balanceAmount<0)
                    throw new RefundError('결제사 환불 금액을 확인하지 못했습니다.');
                actual=Number(op.total)-data.balanceAmount-Number(op.baseline);
                if (actual!==Number(op.amount)) throw new RefundError('결제사 환불액이 요청 금액과 다릅니다. 환불 내역을 대조해주세요.');
            }
            await shopPool.query("UPDATE refund_operations SET status='succeeded',actual_amount=$2,last_error=NULL,updated_at=NOW() WHERE source_key=$1",[spec.sourceKey,actual]);
            op.actual_amount=actual;
        }
        const client=await shopPool.connect();
        try {
            await client.query('BEGIN');
            const o=(await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[spec.orderId])).rows[0];
            const current=(await client.query('SELECT status FROM refund_operations WHERE source_key=$1 FOR UPDATE',[spec.sourceKey])).rows[0];
            if(current.status!=='completed') {
                await spec.apply(client,o,Number(op.actual_amount));
                await client.query('INSERT INTO order_refund_amounts(source_key,order_id,amount) VALUES($1,$2,$3) ON CONFLICT(source_key) DO NOTHING',[spec.sourceKey,spec.orderId,op.actual_amount]);
                await client.query("UPDATE refund_operations SET status='completed',lease_until=NULL,last_error=NULL,updated_at=NOW() WHERE source_key=$1",[spec.sourceKey]);
            }
            await client.query('COMMIT');
        } catch(e) { await client.query('ROLLBACK'); throw e; } finally {client.release();}
        return {amount:Number(op.actual_amount),alreadyCompleted:false};
    } catch(e) {
        await shopPool.query('UPDATE refund_operations SET lease_until=NULL,last_error=$2,updated_at=NOW() WHERE source_key=$1',[spec.sourceKey,e instanceof RefundError?e.message:'환불 또는 완료 저장 결과 확인 필요']).catch(()=>{});
        throw e;
    }
}
