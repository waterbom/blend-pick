const {sendNotice,configuration}=require('./commerce-provider.cjs');
const {sendSMS}=require('./sms-provider.cjs');
const {origin}=require('./customer-notifications.cjs');
/** @param {string} phone @param {string} body @param {string} subject @param {any} context @param {(phone:string,body:string,subject?:string)=>Promise<{ok:boolean,outcome?:string,error?:string}>} fallback */
async function sendShipmentMessage(phone,body,subject,context,fallback=sendSMS){
 if(!context || !configuration(context.site).shipping) return fallback(phone,body,subject);
 const result=await sendNotice({id:'shipment-'+context.id,kind:'shipping',site:context.site,phone:String(phone).replace(/\D/g,''),body,
  variables:{'#{주문번호}':context.order_number,'#{상품명}':context.product_name||'주문 상품','#{택배사}':context.tracking_company||'',
   '#{운송장번호}':context.tracking_number,'#{주문조회URL}':origin(context.site)+'/orders/lookup'}});
 // Existing shipment queue's `sent` explicitly means provider acceptance.
 return {ok:result.status==='accepted',outcome:result.status==='blocked'?'configuration':'unknown',providerId:result.providerId};
}
module.exports={sendShipmentMessage};
