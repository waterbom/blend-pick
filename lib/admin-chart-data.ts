import type { ChartPoint } from '@/components/admin/charts/MetricChart';
import type { ServerTraffic } from '@/lib/server-traffic';
export const kstDay = (value: string | Date) => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function trafficPoints(data: ServerTraffic, grain: 'hour' | 'day', field: 'requests' | 'sentBytes' | 'errors5xx' | 'averageMs'): ChartPoint[] {
  const groups = new Map<string, { value: number; weight: number; observed: boolean }>();
  for (const h of [...data.hours].sort((a,b) => a.hour.localeCompare(b.hour))) {
    const stamp = new Date(Date.parse(h.hour) + 9 * 3600000).toISOString();
    const key = grain === 'day' ? stamp.slice(0,10) : stamp.slice(0,13);
    const row = groups.get(key) || {value:0,weight:0,observed:false};
    if (h[field] !== null) { row.observed = true; row.value += field === 'averageMs' ? h.averageMs! * h.requests : h[field]!; row.weight += h.requests; }
    groups.set(key,row);
  }
  if (!data.effectiveFrom || !data.generatedAt) return [];
  const bucket = grain === 'day' ? 86400000 : 3600000;
  // A missing log bucket is a gap, never a fabricated zero or interpolated request count.
  const start = Math.floor((Date.parse(data.effectiveFrom)+9*3600000)/bucket)*bucket;
  const end = Date.parse(data.generatedAt)+9*3600000;
  const points: ChartPoint[]=[];
  for(let at=start;at<=end;at+=bucket){
    const stamp=new Date(at).toISOString(),key=grain==='day'?stamp.slice(0,10):stamp.slice(0,13),row=groups.get(key);
    points.push({label:grain==='day'?key.slice(5):key.slice(5).replace('T',' ')+'시',values:[row?.observed ? field==='averageMs' ? row.weight ? row.value/row.weight : null : row.value : null]});
  }
  return points;
}
export function settlementPoints(rows: {settled_at:string;net_amount:number|null;fee:number}[]): ChartPoint[] {
  const days = rows.map(r=>kstDay(r.settled_at)).sort();
  const monthly = days.length>0 && Date.parse(days[days.length-1])-Date.parse(days[0])>60*86400000;
  const groups=new Map<string,{net:number|null;fee:number}>();
  for(const r of rows){const key=kstDay(r.settled_at).slice(0,monthly?7:10),v=groups.get(key)||{net:0,fee:0};v.net=v.net===null||r.net_amount===null?null:v.net+Number(r.net_amount);v.fee+=Number(r.fee);groups.set(key,v);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([label,v])=>({label,values:[v.net,v.fee]}));
}
