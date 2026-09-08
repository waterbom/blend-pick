import { promises as fs } from 'node:fs';
import type { SiteKey } from '@/lib/sites';
export type TrafficTotals = { requests:number;sentBytes:number;receivedBytes:number;errors4xx:number;errors5xx:number;botRequests:number;monitorRequests:number;otherRequests:number;slowRequests:number;averageMs:number|null;error5xxPercent:number|null };
export type ServerTraffic = {site:SiteKey;days:number;state:'ready'|'stale'|'unavailable'|'error';generatedAt:string|null;captureStartedAt:string|null;from:string|null;effectiveFrom:string|null;totals:TrafficTotals|null;hours:({hour:string}&TrafficTotals)[];routes:({route:string}&TrafficTotals)[]};
const STATE='/var/lib/blendpick-monitor';
const fields=['requests','sentBytes','receivedBytes','errors4xx','errors5xx','botRequests','monitorRequests','otherRequests','slowRequests'] as const;
function metric(value:unknown):TrafficTotals {
  if(!value||typeof value!=='object')throw Error('Invalid metric');const r=value as Record<string,unknown>;
  const clean={} as TrafficTotals;
  for(const k of fields){if(typeof r[k]!=='number'||!Number.isSafeInteger(r[k])||Number(r[k])<0)throw Error('Invalid metric');clean[k]=r[k] as number;}
  for(const k of ['averageMs','error5xxPercent'] as const){if(r[k]!==null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||Number(r[k])<0))throw Error('Invalid metric');clean[k]=r[k] as number|null;}
  return clean;
}
function date(value:unknown):string {if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Invalid time');return value;}
export function selectTraffic(value:unknown,site:SiteKey,days:number,now=new Date()):ServerTraffic {
  if(!value||typeof value!=='object')throw Error('Invalid summary');
  const r=value as {version:number;mode:string;generatedAt:unknown;captureStartedAt:unknown;ranges:unknown[]};
  if(r.version!==1||r.mode!=='observed'||!Array.isArray(r.ranges))throw Error('Invalid summary');
  const generatedAt=date(r.generatedAt),captureStartedAt=date(r.captureStartedAt);
  if(Date.parse(generatedAt)>+now+60000)throw Error('Future summary');
  const range=r.ranges.find(x=>x&&typeof x==='object'&&(x as {days:number}).days===days) as {from:unknown;effectiveFrom:unknown;sites:unknown[]} | undefined;
  if(!range||!Array.isArray(range.sites))throw Error('Missing range');
  const selected=range.sites.find(x=>x&&typeof x==='object'&&(x as {key:string}).key===site) as {total:unknown;hours:unknown[];routes:unknown[]} | undefined;
  if(!selected||!Array.isArray(selected.hours)||selected.hours.length>750||!Array.isArray(selected.routes)||selected.routes.length>20)throw Error('Missing site');
  return {site,days,state:+now-Date.parse(generatedAt)>45*60000?'stale':'ready',generatedAt,captureStartedAt,from:date(range.from),effectiveFrom:date(range.effectiveFrom),totals:metric(selected.total),hours:selected.hours.map(x=>({hour:date((x as {hour:unknown}).hour),...metric(x)})),routes:selected.routes.map(x=>{const route=(x as {route:string}).route;if(!['home','products','login','assets','api','admin','other'].includes(route))throw Error('Invalid route');return {route,...metric(x)};})};
}
export async function getServerTraffic(site:SiteKey,days:number):Promise<ServerTraffic> {
  const base:ServerTraffic={site,days,state:'unavailable',generatedAt:null,captureStartedAt:null,from:null,effectiveFrom:null,totals:null,hours:[],routes:[]};
  if(![1,7,30].includes(days))return {...base,state:'error'};
  try {
    const file=STATE+'/traffic-summary.json';const stat=await fs.stat(file);if(stat.size>2*1024*1024)throw Error('Summary too large');
    const result=selectTraffic(JSON.parse(await fs.readFile(file,'utf8')),site,days);
    try{const failed=JSON.parse(await fs.readFile(STATE+'/traffic-error.json','utf8'));if(Date.parse(failed.failedAt)>Date.parse(result.generatedAt!))result.state='error';}catch{}
    return result;
  }catch(e){return {...base,state:(e as NodeJS.ErrnoException).code==='ENOENT'?'unavailable':'error'};}
}
