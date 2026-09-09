import { sendSMS as send, smsConfigured as configured } from "@/lib/sms-provider.cjs";
export function smsConfigured(): boolean { return configured(); }
export const PHONE_VERIFY_ENABLED = true;
export function phoneVerifyOn() { return PHONE_VERIFY_ENABLED && smsConfigured(); }
export async function sendSMS(to:string,text:string,subject?:string): Promise<{ok:boolean;error?:string;outcome?:string}> { return send(to,text,subject); }
