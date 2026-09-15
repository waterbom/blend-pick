import { bookingService as service,guard,body,failure,paymentReady,flushNotifications } from '@/lib/dangung-server';
import { smsConfigured } from '@/lib/sms';
import { BookingError } from '@/lib/dangung-core.cjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{await guard(undefined,true);return Response.json({...await service.admin(),paymentReady:paymentReady(),smsConfigured:smsConfigured()},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{await guard(request,true);const input=await body(request);let result;
 switch(input.action){
 case 'settings':if(input.config?.enabled&&!paymentReady())throw new BookingError('실결제 키 설정을 먼저 확인해 주세요.',409);result=await service.settings(input.config);break;
 case 'dates':result=await service.setDates(input);break;
 case 'reconcile':result=await service.reconcile(input.id);break;
 case 'cancel':result=await service.cancel(input.id,input.amount,input.reason);break;
 default:throw new BookingError('잘못된 요청입니다.',400);
 }if(['cancel','reconcile'].includes(input.action)&&result?.id)await flushNotifications(result.id);return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
