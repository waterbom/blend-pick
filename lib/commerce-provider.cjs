const crypto = require('node:crypto');
const BASE = 'https://api.solapi.com';
const KINDS = ['paid','shipping','refund','delay','restock','opening'];
function config(site, kind) {
  const prefix = site === 'sanjipick' ? 'SANJIPICK' : site === 'blendpick' ? 'BLENDPICK' : '';
  if (!prefix || !KINDS.includes(kind)) return null;
  const pfId = process.env[`${prefix}_SOLAPI_PFID`];
  const templateId = process.env[`${prefix}_ALIMTALK_${kind.toUpperCase()}_TEMPLATE`];
  return process.env.COMMERCE_ALIMTALK_ENABLED === 'true' && process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && pfId && templateId
    ? {pfId,templateId} : null;
}
function configuration(site) {
  return Object.fromEntries(KINDS.map(kind => [kind, !!config(site,kind)]));
}
function headers() {
  const date = new Date().toISOString(), salt = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256',process.env.SOLAPI_API_SECRET).update(date+salt).digest('hex');
  return {'Content-Type':'application/json',Authorization:`HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`};
}
async function sendNotice(job) {
  const settings = config(job.site,job.kind);
  if (!settings) return {status:'blocked',error:'TEMPLATE_NOT_CONFIGURED'};
  if (!/^01[016789]\d{7,8}$/.test(job.phone || '')) return {status:'review',error:'INVALID_RECIPIENT'};
  const fallback = process.env.COMMERCE_SMS_FALLBACK === 'true' && !!process.env.SOLAPI_SENDER;
  try {
    const response = await fetch(`${BASE}/messages/v4/send-many/detail`, {
      method:'POST',headers:headers(),signal:AbortSignal.timeout(15000),
      body:JSON.stringify({messages:[{to:job.phone,
        ...(fallback ? {from:process.env.SOLAPI_SENDER,text:job.body} : {}),
        kakaoOptions:{...settings,disableSms:!fallback,variables:job.variables},
        customFields:{notificationId:job.id}}]})
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return {status:'review',error:!response.ok ? `PROVIDER_HTTP_${response.status}` : 'PROVIDER_INVALID_RESPONSE'};
    if (data.failedMessageList?.length) return {status:'review',error:'PROVIDER_REJECTED'};
    const message = data.messageList?.[0];
    if (!message?.messageId || !/^2\d{3}$/.test(String(message.statusCode))) return {status:'review',error:'PROVIDER_RESULT_UNKNOWN'};
    return {status:'accepted',providerId:message.messageId};
  } catch { return {status:'review',error:'PROVIDER_RESULT_UNKNOWN'}; }
}
async function receipt(messageId) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(messageId) || !process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) return {status:'review',error:'RECEIPT_CONFIG_INVALID'};
  const query = new URLSearchParams({criteria:'messageId',cond:'eq',value:messageId,limit:'1'});
  try {
    const response = await fetch(`${BASE}/messages/v4/list?${query}`,{headers:headers(),signal:AbortSignal.timeout(15000)});
    if (!response.ok) return {status:'accepted',error:'RECEIPT_UNAVAILABLE'};
    const data = await response.json();
    const message = data?.messageList?.[messageId];
    if (!message) return {status:'accepted',error:'RECEIPT_UNAVAILABLE'};
    if (String(message.statusCode)==='4000') return {status:'delivered'};
    // Do not resend when the provider is still handling SMS replacement.
    if (message.status!=='COMPLETE') return {status:'accepted'};
    return {status:'review',error:'DELIVERY_FAILED_CHECK_REPLACEMENT'};
  } catch { return {status:'accepted',error:'RECEIPT_UNAVAILABLE'}; }
}
module.exports={configuration,sendNotice,receipt};
