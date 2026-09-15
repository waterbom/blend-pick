import { cookies } from 'next/headers';
import { bookingService as service, guard, owner, body, failure, paymentReady, flushNotifications } from '@/lib/dangung-server';
import { BookingError } from '@/lib/dangung-core.cjs';
import { phoneVerifyOn } from '@/lib/sms';
import { isPhoneVerified } from '@/lib/phone-verify';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{await guard();const id=new URL(request.url).searchParams.get('id');
 if(id)return Response.json(await service.status(id,await owner()),{headers:{'Cache-Control':'no-store'}});
 await owner(true);const calendar=await service.calendar();return Response.json({...calendar,paymentReady:paymentReady(),phoneVerify:phoneVerifyOn()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{await guard(request);const input=await body(request),token=await owner(true);let result;
 switch(input.action){
 case 'lookup':result=await service.lookup(input,token);break;
 case 'quote':result=await service.getQuote(input);break;
 case 'reserve':
 if(!paymentReady())throw new BookingError('예약 결제를 준비 중입니다.',503);
 if(phoneVerifyOn()&&!await isPhoneVerified((await cookies()).get('phone_verified')?.value||'',input.buyerPhone||''))throw new BookingError('휴대폰 인증을 완료해 주세요.',400);
 result=await service.reserve(input,token);break;
 case 'confirm':result=await service.confirm(input,token);break;
 case 'reconcile':result=await service.reconcile(input.orderId,token);break;
 case 'abandon':result=await service.abandon(input.orderId,token);break;
 case 'cancelRequest':result=await service.requestCancel(input.orderId,token);break;
 default:throw new BookingError('잘못된 요청입니다.',400);
 }
 if(['confirm','reconcile'].includes(input.action)&&result?.id)await flushNotifications(result.id);
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
