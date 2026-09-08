const {estimatePaymentFee}=require('./payment-fees.cjs');
async function recordDeliverySettlement(client,order){
 const existing=await client.query('SELECT id FROM settlements WHERE order_id=$1',[order.id]);
 if(existing.rows.length)return;
 const gross=Number(order.total_amount),fee=estimatePaymentFee(gross,order.payment_method);
 await client.query(`INSERT INTO settlements(payment_key,order_id,gross_amount,fee,net_amount,settled_at,created_at,fee_estimated)
 VALUES($1,$2,$3,$4,$5,NOW(),NOW(),true)`,[order.payment_key||`manual_${order.order_number}`,order.id,gross,fee,gross-fee]);
}
module.exports={recordDeliverySettlement};
