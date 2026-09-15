import { processQueue } from '@/lib/dangung-notifications.cjs';
import { sendSMS, smsConfigured } from '@/lib/sms';
import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import pool from '@/lib/db-shop';
import { verifyAdminToken } from '@/lib/auth';
import { siteFromHost } from '@/lib/sites';
import { service, BookingError } from '@/lib/dangung-core.cjs';

export const DANGUNG_COOKIE = 'dangung_booking';
export function paymentReady() {
 const client=process.env.TOSS_CLIENT_KEY||'',secret=process.env.TOSS_SECRET_KEY||'';
 return client.startsWith('live_ck_')&&secret.startsWith('live_sk_');
}
async function toss(path:string, body?:object, key?:string):Promise<any> {
 if(!paymentReady())throw new BookingError('예약 결제를 준비 중입니다.',503);
 let response:Response;
 try{response=await fetch(`https://api.tosspayments.com/v1/payments${path}`,{method:body?'POST':'GET',headers:{Authorization:`Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64')}`,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new BookingError('결제 상태를 확인 중입니다. 다시 확인을 눌러 주세요. 중복 결제하지 마세요.',503);}
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const error=new BookingError('결제 상태를 확인하지 못했습니다. 예약번호로 문의하거나 다시 확인해 주세요.',503);(error as any).providerCode=result.code;throw error;}
 return result;
}
export const bookingService=service(pool,{
 async confirm(data:{orderId:string;paymentKey:string;amount:number}){try{return await toss('/confirm',data,`dangung-confirm-${data.orderId}`);}catch(error){if((error as any).providerCode==='ALREADY_PROCESSED_PAYMENT')return toss(`/orders/${encodeURIComponent(data.orderId)}`);throw error;}},
 lookup:(id:string)=>toss(`/orders/${encodeURIComponent(id)}`),
 cancel:(paymentKey:string,amount:number,reason:string,id:string)=>toss(`/${encodeURIComponent(paymentKey)}/cancel`,{cancelReason:reason,cancelAmount:amount},`dangung-cancel-${id}`),
});
export async function guard(request?:Request,admin=false){
 const h=await headers();
 if(siteFromHost(h.get('host'))!=='blendpick')throw new BookingError('페이지를 찾을 수 없습니다.',404);
 if(request&&request.method!=='GET'){
 const origin=request.headers.get('origin');
 if(!origin||new URL(origin).host!==h.get('host'))throw new BookingError('잘못된 요청입니다.',403);
 }
 if(admin){const token=(await cookies()).get('admin_token')?.value;if(!token||!await verifyAdminToken(token))throw new BookingError('관리자 로그인이 필요합니다.',401);}
}
export async function owner(create=false){const jar=await cookies();let token=jar.get(DANGUNG_COOKIE)?.value;
 if(!token||!/^[a-f0-9]{64}$/.test(token)){if(!create)throw new BookingError('이 브라우저의 예약을 찾을 수 없습니다. 예약번호로 문의해 주세요.',401);token=randomBytes(32).toString('hex');jar.set(DANGUNG_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:90*86400});}return token;}
export async function body(request:Request){const raw=await request.text();if(raw.length>16000)throw new BookingError('요청 내용이 너무 큽니다.',413);try{return JSON.parse(raw);}catch{throw new BookingError('잘못된 요청입니다.',400);}}
export function failure(error:unknown){const status=error instanceof BookingError?error.status:503;return Response.json({error:error instanceof BookingError?error.message:'예약 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status,headers:{'Cache-Control':'no-store'}});}

export async function flushNotifications(reservationId:string){
 try{if(smsConfigured())await processQueue(pool,sendSMS,{reservationId,limit:2});}
 catch{console.error('Dangung notification queue requires inspection');}
}
