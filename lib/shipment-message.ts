import {sendShipmentMessage as send} from '@/lib/shipment-message.cjs';
import {sendSMS} from '@/lib/sms';
export function sendShipmentMessage(phone:string,body:string,subject:string,context:Record<string,unknown>){
 return send(phone,body,subject,context,sendSMS);
}
