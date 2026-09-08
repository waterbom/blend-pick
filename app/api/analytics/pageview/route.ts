import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { SITES, type SiteKey } from '@/lib/sites';
import { analyticsConfigured } from '@/lib/visit-analytics/db';
import { parsePageview } from '@/lib/visit-analytics/rules';
import { recordPageview } from '@/lib/visit-analytics/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
let budget = { minute: 0, count: 0 };
function response(status: number) { return new Response(null,{status,headers}); }
async function readInput(req: Request) {
  if (Number(req.headers.get('content-length')) > 1024) throw Error('large');
  const reader=req.body?.getReader(); if (!reader) throw Error('empty');
  const chunks: Uint8Array[]=[];let bytes=0;
  try { while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw Error('large');}chunks.push(value);} }
  finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function POST(req: Request) {
  if (process.env.ANALYTICS_ENABLED !== 'true') return response(204);
  if (!analyticsConfigured()) return response(503);
  const host=(req.headers.get('host')||'').toLowerCase();
  let site=(Object.keys(SITES) as SiteKey[]).find(k=>SITES[k].host.toLowerCase()===host);
  const local=process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if(!site && local) site=req.headers.get('x-site')==='sanjipick'?'sanjipick':'blendpick';
  if(!site) return response(403);
  const expected=local?new URL(req.url).origin:`https://${SITES[site].host}`;
  if(req.headers.get('origin')!==expected || req.headers.get('sec-fetch-site')==='cross-site')return response(403);
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return response(415);
  if(/bot|crawler|spider|headless|lighthouse|Blendpick-ReadOnly-Monitor/i.test(req.headers.get('user-agent')||'') || req.headers.get('sec-gpc')==='1' || req.headers.get('dnt')==='1')return response(204);
  const token=(await cookies()).get('admin_token')?.value;
  if(token && await verifyAdminToken(token))return response(204);
  let input;try{input=parsePageview(await readInput(req));}catch{return response(400);}
  if(!input)return response(400);
  // 프로세스별 비상 상한 + DB에서 방문자별 분당 60건 상한. 보안 방화벽 대체는 아님.
  const minute=Math.floor(Date.now()/60000);if(budget.minute!==minute)budget={minute,count:0};
  if(++budget.count>3000)return response(429);
  try {const result=await recordPageview(site,input);return response(result==='limited'?429:204);}
  catch {console.error('visit_analytics_write_failed');return response(503);}
}
