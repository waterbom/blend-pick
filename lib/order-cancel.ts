import shopPool from '@/lib/db-shop';
import type { SiteKey } from '@/lib/sites';
import { runRefund, RefundError } from '@/lib/refund-operation';
export type ShopCancelResult = {ok:true;alreadyCancelled?:true;refunded:boolean} | {ok:false;error:string;httpStatus:number};
export async function cancelShopOrder(orderId:string,reason:string,opts:{deductShipping?:boolean;site?:SiteKey;customerRequest?:boolean}={}):Promise<ShopCancelResult> {
    try {
        const found=await shopPool.query("SELECT status FROM orders WHERE id=$1 AND order_type<>'hotel' AND ($2::text IS NULL OR site=$2)",[orderId,opts.site??null]);
        if(!found.rows.length)return {ok:false,error:'주문을 찾을 수 없습니다.',httpStatus:404};
        if(found.rows[0].status==='cancelled')return {ok:true,alreadyCancelled:true,refunded:false};
        const result=await runRefund({sourceKey:'cancel:'+orderId,orderId,site:opts.site,
            prepare:async(c,o)=>{
                if(opts.customerRequest && !['paid','confirmed','preparing'].includes(o.status))throw new RefundError('출고 상태가 변경되었습니다. 주문 내역에서 다시 확인해주세요.',409);
                if(o.order_type==='hotel'||!['paid','confirmed','preparing','shipped','delivered','cancel_requested'].includes(o.status))throw new RefundError('현재 상태는 주문 취소로 변경할 수 없습니다. 교환·반품 상세에서 확인해주세요.');
                const refunds=Number((await c.query('SELECT COALESCE(SUM(amount),0) amount FROM order_refund_amounts WHERE order_id=$1',[orderId])).rows[0].amount);
                return {amount:Math.max(0,Number(o.total_amount)-refunds-(opts.deductShipping?Number(o.shipping_fee||0):0)),reason};
            },
            apply:async(c,o)=>{
                if(o.status==='cancelled')return;
                await c.query("UPDATE orders SET status='cancelled',cancelled_at=NOW(),updated_at=NOW(),refund_amount_unresolved=false WHERE id=$1",[orderId]);
                const its=await c.query('SELECT product_id,option_id,quantity FROM order_items WHERE order_id=$1 AND product_id IS NOT NULL ORDER BY product_id,option_id',[orderId]);
                for(const i of its.rows){
                    await c.query('UPDATE products_shop SET stock=CASE WHEN stock<0 THEN stock ELSE stock+$1 END,updated_at=NOW() WHERE id=$2',[i.quantity,i.product_id]);
                    if(i.option_id)await c.query('UPDATE product_options SET stock=CASE WHEN stock<0 THEN stock ELSE stock+$1 END WHERE id=$2',[i.quantity,i.option_id]);
                }
            }});
        return {ok:true,refunded:result.amount>0,...(result.alreadyCompleted?{alreadyCancelled:true as const}:{})};
    } catch(e) {
        console.error('[order-cancel] 환불 또는 완료 저장 확인 필요',e);
        return {ok:false,error:e instanceof RefundError?e.message:'취소 결과 확인이 필요합니다. 같은 주문에서 다시 확인해주세요.',httpStatus:e instanceof RefundError?e.status:503};
    }
}
